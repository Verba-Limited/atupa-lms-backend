import { Inject, Injectable } from '@nestjs/common';
import type { Actor } from '../../../shared/application/actor';
import type { EventBus } from '../../../shared/application/event-bus.port';
import { EVENT_BUS } from '../../../shared/application/event-bus.port';
import { QuizAttemptSubmitted } from '../../../shared/contracts/events';
import {
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from '../../../shared/domain/errors';
import { CatalogQueryService, Quiz, toLearnerQuestion } from '../../catalog';
import {
  gradeQuiz,
  isPastDeadline,
  QuizAttempt,
  remainingSeconds,
  shuffleQuestionOrder,
  TIMER_GRACE_SECONDS,
} from '../domain/quiz-attempt.entity';
import { externalPlayback, MediaKind, MediaService } from '../../media';
import { LearningAccessService } from './learning-access.service';
import type { QuizAttemptRepository } from './ports/quiz-attempt.repository.port';
import { QUIZ_ATTEMPT_REPOSITORY } from './ports/quiz-attempt.repository.port';

@Injectable()
export class QuizAttemptsService {
  constructor(
    @Inject(QUIZ_ATTEMPT_REPOSITORY)
    private readonly attempts: QuizAttemptRepository,
    private readonly catalog: CatalogQueryService,
    private readonly access: LearningAccessService,
    @Inject(EVENT_BUS) private readonly events: EventBus,
    private readonly media: MediaService,
  ) {}

  /**
   * Starts (or resumes) an attempt. The timer and question order are fixed
   * server-side so they cannot be manipulated by the client.
   */
  async start(actor: Actor, quizId: string) {
    const { quiz, course } = await this.catalog.getQuizForGrading(quizId);
    await this.access.assertCanLearn(actor, course);

    let attempt = await this.attempts.findInProgress(actor.userId, quizId);
    if (attempt && isPastDeadline(attempt)) {
      await this.expire(attempt, quiz);
      attempt = null;
    }
    if (!attempt) {
      const used = await this.attempts.countFinished(actor.userId, quizId);
      if (quiz.maxAttempts && used >= quiz.maxAttempts) {
        throw new ForbiddenError(
          `You have used all ${quiz.maxAttempts} attempts for this quiz`,
        );
      }
      const now = new Date();
      const ids = quiz.questions.map((q) => q.id);
      const [previous] = quiz.randomizeQuestions
        ? await this.attempts.list({ userIds: [actor.userId], quizId }, 1)
        : [];
      attempt = await this.attempts.create({
        userId: actor.userId,
        quizId,
        courseId: quiz.courseId,
        lessonId: quiz.lessonId,
        questionOrder: quiz.randomizeQuestions
          ? shuffleQuestionOrder(ids, previous?.questionOrder)
          : ids,
        status: 'in_progress',
        startedAt: now,
        expiresAt: quiz.timerSeconds
          ? new Date(now.getTime() + quiz.timerSeconds * 1000)
          : undefined,
        answers: {},
        results: [],
        earnedPoints: 0,
        totalPoints: 0,
        scorePercent: 0,
        passed: false,
      });
    }
    const byId = new Map(quiz.questions.map((q) => [q.id, q]));
    return {
      attemptId: attempt.id,
      quiz: {
        id: quiz.id,
        title: quiz.title,
        description: quiz.description,
        passScorePercent: quiz.passScorePercent,
        timerSeconds: quiz.timerSeconds,
        maxAttempts: quiz.maxAttempts,
      },
      startedAt: attempt.startedAt,
      expiresAt: attempt.expiresAt,
      /** Clients should count down from this, not from their own clock. */
      remainingSeconds: remainingSeconds(attempt),
      serverTime: new Date(),
      questions: await this.withMedia(
        attempt.questionOrder
          .map((id) => byId.get(id))
          .filter((q) => !!q)
          .map(toLearnerQuestion),
      ),
    };
  }

  async submit(
    actor: Actor,
    attemptId: string,
    answers: Record<string, unknown>,
  ) {
    const attempt = await this.requireOwnAttempt(actor, attemptId);
    if (attempt.status !== 'in_progress') {
      throw new ValidationError('This attempt has already been submitted');
    }
    const { quiz } = await this.catalog.getQuizForGrading(attempt.quizId);

    if (isPastDeadline(attempt)) {
      const expired = await this.expire(attempt, quiz);
      return { ...this.toResult(expired ?? attempt, quiz), timedOut: true };
    }

    const known = new Set(quiz.questions.map((q) => q.id));
    const cleanAnswers = Object.fromEntries(
      Object.entries(answers ?? {}).filter(([id]) => known.has(id)),
    );
    const grade = gradeQuiz(
      quiz.questions,
      cleanAnswers,
      quiz.passScorePercent,
    );
    const finished = await this.attempts.finish(attempt.id, {
      ...grade,
      answers: cleanAnswers,
      status: 'submitted',
      submittedAt: new Date(),
    });
    if (!finished)
      throw new ValidationError('This attempt has already been submitted');
    await this.publish(finished, quiz);
    return { ...this.toResult(finished, quiz), timedOut: false };
  }

  /** Correct answers and explanations, after submission, if the quiz allows it. */
  async review(actor: Actor, attemptId: string) {
    const attempt = await this.requireOwnAttempt(actor, attemptId);
    if (attempt.status === 'in_progress') {
      throw new ValidationError('Submit the attempt before reviewing answers');
    }
    const { quiz } = await this.catalog.getQuizForGrading(attempt.quizId);
    if (!quiz.allowReview) {
      throw new ForbiddenError('Answer review is not enabled for this quiz');
    }
    const resultById = new Map(attempt.results.map((r) => [r.questionId, r]));
    const byId = new Map(quiz.questions.map((q) => [q.id, q]));
    return {
      ...this.toResult(attempt, quiz),
      questions: await this.withMedia(
        attempt.questionOrder
          .map((id) => byId.get(id))
          .filter((q) => !!q)
          .map((q) => ({
            ...toLearnerQuestion(q),
            yourAnswer: attempt.answers[q.id] ?? null,
            correctAnswer: q.correctAnswer,
            explanation: q.explanation,
            correct: resultById.get(q.id)?.correct ?? false,
          })),
      ),
    };
  }

  /** Adds `media` playback to image/audio questions. */
  private async withMedia<T extends { type: string; mediaUrl?: string }>(
    questions: T[],
  ) {
    const resolved = await this.media.resolveUrls(
      questions.map((q) => q.mediaUrl),
    );
    return questions.map((q) => ({
      ...q,
      media: q.mediaUrl
        ? (resolved.get(q.mediaUrl) ??
          externalPlayback(
            q.mediaUrl,
            q.type === 'audio' ? MediaKind.AUDIO : MediaKind.IMAGE,
          ))
        : null,
    }));
  }

  async listMine(actor: Actor, quizId?: string) {
    const attempts = await this.attempts.list(
      { userIds: [actor.userId], quizId },
      100,
    );
    return attempts.map((a) => this.summarize(a));
  }

  /** For teacher/parent reports; access is checked by the caller. */
  async listForLearners(
    userIds: string[],
    filter: { quizId?: string; courseId?: string },
  ) {
    const attempts = await this.attempts.list({ userIds, ...filter }, 500);
    return attempts.map((a) => this.summarize(a));
  }

  private summarize(attempt: QuizAttempt) {
    return {
      id: attempt.id,
      userId: attempt.userId,
      quizId: attempt.quizId,
      courseId: attempt.courseId,
      status: attempt.status,
      startedAt: attempt.startedAt,
      submittedAt: attempt.submittedAt,
      scorePercent: attempt.scorePercent,
      passed: attempt.passed,
    };
  }

  private toResult(attempt: QuizAttempt, quiz: Quiz) {
    return {
      attemptId: attempt.id,
      quizId: quiz.id,
      status: attempt.status,
      scorePercent: attempt.scorePercent,
      passed: attempt.passed,
      passScorePercent: quiz.passScorePercent,
      earnedPoints: attempt.earnedPoints,
      totalPoints: attempt.totalPoints,
      correctCount: attempt.results.filter((r) => r.correct).length,
      totalQuestions: quiz.questions.length,
      results: attempt.results.map((r) => ({
        questionId: r.questionId,
        correct: r.correct,
      })),
      reviewAvailable: quiz.allowReview,
    };
  }

  /**
   * Records attempts whose timer ran out and were never submitted (the
   * learner closed the app), so they count as attempts and show in reports.
   */
  async expireOverdue(now = new Date()): Promise<number> {
    const overdue = await this.attempts.findOverdue(
      new Date(now.getTime() - TIMER_GRACE_SECONDS * 1000),
      200,
    );
    if (!overdue.length) return 0;
    const quizzes = await this.catalog.findQuizzes([
      ...new Set(overdue.map((a) => a.quizId)),
    ]);
    const byId = new Map(quizzes.map((q) => [q.id, q]));
    let count = 0;
    for (const attempt of overdue) {
      const quiz = byId.get(attempt.quizId);
      // A deleted quiz has nothing to report on; just close the attempt.
      const expired = quiz
        ? await this.expire(attempt, quiz)
        : await this.attempts.finish(attempt.id, {
            status: 'expired',
            submittedAt: attempt.expiresAt,
          });
      if (expired) count++;
    }
    return count;
  }

  private async expire(
    attempt: QuizAttempt,
    quiz: Quiz,
  ): Promise<QuizAttempt | null> {
    const totalPoints = quiz.questions.reduce((s, q) => s + q.points, 0);
    const expired = await this.attempts.finish(attempt.id, {
      status: 'expired',
      // Stamp the deadline, not "now", so durations reflect the timer.
      submittedAt: attempt.expiresAt ?? new Date(),
      results: quiz.questions.map((q) => ({
        questionId: q.id,
        correct: false,
        points: 0,
      })),
      scorePercent: 0,
      passed: false,
      earnedPoints: 0,
      totalPoints,
    });
    if (expired) await this.publish(expired, quiz);
    return expired;
  }

  private async publish(attempt: QuizAttempt, quiz: Quiz) {
    const durationSeconds = Math.round(
      ((attempt.submittedAt ?? new Date()).getTime() -
        attempt.startedAt.getTime()) /
        1000,
    );
    await this.events.publish(
      new QuizAttemptSubmitted(
        attempt.userId,
        attempt.id,
        quiz.id,
        quiz.title,
        quiz.courseId,
        quiz.lessonId,
        attempt.scorePercent,
        attempt.passed,
        durationSeconds,
      ),
    );
  }

  private async requireOwnAttempt(
    actor: Actor,
    attemptId: string,
  ): Promise<QuizAttempt> {
    const attempt = await this.attempts.findById(attemptId);
    if (!attempt || attempt.userId !== actor.userId) {
      throw new NotFoundError('Attempt not found');
    }
    return attempt;
  }
}
