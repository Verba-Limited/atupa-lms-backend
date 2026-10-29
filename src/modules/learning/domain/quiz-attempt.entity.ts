import type { QuizQuestion } from '../../catalog';
import { matchAnswer } from './answer-matcher';

/** Extra time allowed after the timer for network latency. */
export const TIMER_GRACE_SECONDS = 30;

export type AttemptStatus = 'in_progress' | 'submitted' | 'expired';

export interface QuestionResult {
  questionId: string;
  correct: boolean;
  points: number;
}

export interface QuizAttempt {
  id: string;
  userId: string;
  quizId: string;
  courseId: string;
  lessonId?: string;
  /** Question ids in the order this learner sees them. */
  questionOrder: string[];
  status: AttemptStatus;
  startedAt: Date;
  expiresAt?: Date;
  submittedAt?: Date;
  answers: Record<string, unknown>;
  results: QuestionResult[];
  earnedPoints: number;
  totalPoints: number;
  scorePercent: number;
  passed: boolean;
  createdAt?: Date;
}

export interface GradeResult {
  results: QuestionResult[];
  earnedPoints: number;
  totalPoints: number;
  scorePercent: number;
  passed: boolean;
}

export function gradeQuiz(
  questions: QuizQuestion[],
  answers: Record<string, unknown>,
  passScorePercent: number,
): GradeResult {
  const results = questions.map((q) => {
    const correct = matchAnswer(q.correctAnswer, answers[q.id], {
      acceptedAnswers: q.acceptedAnswers,
      ordered: q.ordered,
    });
    return { questionId: q.id, correct, points: correct ? q.points : 0 };
  });
  const totalPoints = questions.reduce((sum, q) => sum + q.points, 0);
  const earnedPoints = results.reduce((sum, r) => sum + r.points, 0);
  const scorePercent = totalPoints
    ? Math.round((earnedPoints / totalPoints) * 100)
    : 0;
  return {
    results,
    earnedPoints,
    totalPoints,
    scorePercent,
    passed: scorePercent >= passScorePercent,
  };
}

export function isPastDeadline(
  attempt: Pick<QuizAttempt, 'expiresAt'>,
  now = new Date(),
): boolean {
  return (
    !!attempt.expiresAt &&
    now.getTime() > attempt.expiresAt.getTime() + TIMER_GRACE_SECONDS * 1000
  );
}

/** Fisher-Yates shuffle (no biased sort-based shuffling). */
export function shuffle<T>(
  items: T[],
  random: () => number = Math.random,
): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

/**
 * Shuffles question ids so a fresh attempt never repeats the previous
 * attempt's order (with 2-3 questions a plain shuffle repeats it often).
 */
export function shuffleQuestionOrder(
  ids: string[],
  previous: string[] = [],
  random: () => number = Math.random,
): string[] {
  const order = shuffle(ids, random);
  const same =
    order.length > 1 &&
    order.length === previous.length &&
    order.every((id, i) => id === previous[i]);
  // Rotating a sequence of 2+ distinct ids always changes it.
  return same ? [...order.slice(1), order[0]] : order;
}

/** Seconds left on the timer (grace excluded), or null if untimed. */
export function remainingSeconds(
  attempt: Pick<QuizAttempt, 'expiresAt'>,
  now = new Date(),
): number | null {
  if (!attempt.expiresAt) return null;
  return Math.max(
    0,
    Math.ceil((attempt.expiresAt.getTime() - now.getTime()) / 1000),
  );
}
