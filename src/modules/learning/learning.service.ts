import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Quiz, QuizDocument } from '../catalog/schemas/quiz.schema';
import { ProgressService } from '../progress/progress.service';
import { QuizAttempt, QuizAttemptDocument } from './schemas/quiz-attempt.schema';
import { QuizAnswerMap, QuizScoringService } from './quiz-scoring.service';

@Injectable()
export class LearningService {
  constructor(
    @InjectModel(Quiz.name) private readonly quizModel: Model<Quiz>,
    @InjectModel(QuizAttempt.name)
    private readonly attemptModel: Model<QuizAttempt>,
    private readonly quizScoringService: QuizScoringService,
    private readonly progressService: ProgressService,
  ) {}

  async submitQuizAttempt(input: {
    userId: string;
    quizId: string;
    answers: QuizAnswerMap;
    durationSeconds?: number;
  }) {
    const quiz = await this.quizModel.findById(input.quizId).exec();
    if (!quiz) throw new NotFoundException('Quiz not found');

    const questions = quiz.randomizeQuestions
      ? [...quiz.questions].sort(() => Math.random() - 0.5)
      : quiz.questions;

    const result = this.quizScoringService.scoreAttempt(
      questions,
      input.answers,
      quiz.passScorePercent,
    );

    const attempt = await this.attemptModel.create({
      userId: input.userId,
      quizId: new Types.ObjectId(input.quizId),
      lessonId: quiz.lessonId,
      scorePercent: result.scorePercent,
      passed: result.passed,
      answers: input.answers,
      durationSeconds: input.durationSeconds,
    });

    await this.progressService.recordQuizResult({
      userId: input.userId,
      lessonId: String(quiz.lessonId),
      scorePercent: result.scorePercent,
      passed: result.passed,
      learningMinutes: input.durationSeconds
        ? Math.ceil(input.durationSeconds / 60)
        : 1,
    });

    return { attempt, result };
  }

  listAttempts(userId: string, quizId?: string): Promise<QuizAttemptDocument[]> {
    const query: Record<string, unknown> = { userId };
    if (quizId) query.quizId = new Types.ObjectId(quizId);
    return this.attemptModel.find(query).sort({ createdAt: -1 }).exec();
  }

  getQuiz(quizId: string): Promise<QuizDocument | null> {
    return this.quizModel.findById(quizId).exec();
  }
}
