import {
  Enrollment,
  LearnerCounters,
  LearnerStats,
  LearningEvent,
  LearningEventType,
  LessonProgress,
  QuizResult,
} from '../../domain/progress.entities';
import { StreakUpdate } from '../../domain/gamification.rules';

export const ENROLLMENT_REPOSITORY = Symbol('ENROLLMENT_REPOSITORY');
export const LESSON_PROGRESS_REPOSITORY = Symbol('LESSON_PROGRESS_REPOSITORY');
export const ACTIVITY_COMPLETION_REPOSITORY = Symbol(
  'ACTIVITY_COMPLETION_REPOSITORY',
);
export const QUIZ_RESULT_REPOSITORY = Symbol('QUIZ_RESULT_REPOSITORY');
export const LEARNER_STATS_REPOSITORY = Symbol('LEARNER_STATS_REPOSITORY');
export const LEARNING_EVENT_REPOSITORY = Symbol('LEARNING_EVENT_REPOSITORY');

export interface CourseEnrollmentStats {
  courseId: string;
  enrolled: number;
  completed: number;
}

export interface EnrollmentRepository {
  find(userId: string, courseId: string): Promise<Enrollment | null>;
  /** Creates the enrollment if missing and refreshes lastAccessedAt. */
  touch(
    userId: string,
    courseId: string,
    languageCode: string,
  ): Promise<{ enrollment: Enrollment; created: boolean }>;
  setProgress(
    userId: string,
    courseId: string,
    percent: number,
    completedAt?: Date,
  ): Promise<void>;
  remove(userId: string, courseId: string): Promise<boolean>;
  listByUser(
    userId: string,
    status?: Enrollment['status'],
  ): Promise<Enrollment[]>;
  listByUsers(userIds: string[]): Promise<Enrollment[]>;
  courseStats(filter: {
    userIds?: string[];
    limit: number;
  }): Promise<CourseEnrollmentStats[]>;
}

export interface LessonProgressRepository {
  savePosition(
    userId: string,
    courseId: string,
    lessonId: string,
    position: {
      progressPercent?: number;
      lastBlockIndex?: number;
      lastActivityId?: string;
    },
  ): Promise<LessonProgress>;
  /** True only the first time the lesson is completed. */
  markCompleted(
    userId: string,
    courseId: string,
    lessonId: string,
  ): Promise<boolean>;
  listByUserCourse(userId: string, courseId: string): Promise<LessonProgress[]>;
  completedLessonIds(userId: string, courseId: string): Promise<Set<string>>;
  latestForUser(userId: string): Promise<LessonProgress | null>;
}

export interface ActivityCompletionRepository {
  /** Returns points-relevant outcome: first completion, or first time correct. */
  record(input: {
    userId: string;
    courseId: string;
    lessonId: string;
    activityId: string;
    correct: boolean;
  }): Promise<'new' | 'now_correct' | 'repeat'>;
  countByUser(userId: string, courseId?: string): Promise<number>;
}

export interface QuizResultRepository {
  record(input: {
    userId: string;
    quizId: string;
    quizTitle: string;
    courseId: string;
    scorePercent: number;
    passed: boolean;
  }): Promise<{ firstPass: boolean }>;
  passedQuizIds(userId: string, courseId: string): Promise<Set<string>>;
  listByUser(userId: string, limit: number): Promise<QuizResult[]>;
  averageBestScore(
    userIds: string[],
  ): Promise<{ average: number; count: number }>;
  listByUsers(userIds: string[], limit: number): Promise<QuizResult[]>;
}

export interface StatsDelta {
  points?: number;
  learningSeconds?: number;
  counters?: Partial<LearnerCounters>;
}

export interface LearnerStatsRepository {
  get(userId: string): Promise<LearnerStats>;
  findByUsers(userIds: string[]): Promise<LearnerStats[]>;
  applyDelta(userId: string, delta: StatsDelta): Promise<LearnerStats>;
  /** Optimistic update: only applies if lastActiveDate is still `expectedLastDate`. */
  setStreak(
    userId: string,
    expectedLastDate: string | undefined,
    streak: StreakUpdate,
  ): Promise<boolean>;
  addBadge(userId: string, code: string): Promise<boolean>;
  addLanguage(userId: string, languageCode: string): Promise<void>;
  setHeartbeat(userId: string, at: Date): Promise<void>;
  findUserIdsWithStreakOn(date: string, limit: number): Promise<string[]>;
}

export interface LearningEventRepository {
  append(event: Omit<LearningEvent, 'id'>): Promise<void>;
  listByUser(userId: string, limit: number): Promise<LearningEvent[]>;
  listByUsers(userIds: string[], limit: number): Promise<LearningEvent[]>;
  countByType(filter: {
    since?: Date;
    userIds?: string[];
  }): Promise<Record<string, number>>;
  activeUsers(filter: { since: Date; userIds?: string[] }): Promise<number>;
  pointsLeaderboard(filter: {
    since?: Date;
    userIds?: string[];
    limit: number;
  }): Promise<Array<{ userId: string; points: number }>>;
  countByTypeForUser(
    userId: string,
    types: LearningEventType[],
  ): Promise<number>;
  exists(
    userId: string,
    type: LearningEventType,
    refId: string,
  ): Promise<boolean>;
}
