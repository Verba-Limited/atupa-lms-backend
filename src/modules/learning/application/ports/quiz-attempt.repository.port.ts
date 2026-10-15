import { QuizAttempt } from '../../domain/quiz-attempt.entity';

export const QUIZ_ATTEMPT_REPOSITORY = Symbol('QUIZ_ATTEMPT_REPOSITORY');

export interface QuizAttemptRepository {
  create(input: Omit<QuizAttempt, 'id'>): Promise<QuizAttempt>;
  findById(id: string): Promise<QuizAttempt | null>;
  findInProgress(userId: string, quizId: string): Promise<QuizAttempt | null>;
  countFinished(userId: string, quizId: string): Promise<number>;
  /** Atomically finishes an in-progress attempt; null if already finished. */
  finish(id: string, patch: Partial<QuizAttempt>): Promise<QuizAttempt | null>;
  list(
    filter: { userIds: string[]; quizId?: string; courseId?: string },
    limit: number,
  ): Promise<QuizAttempt[]>;
}
