export interface Enrollment {
  id: string;
  userId: string;
  courseId: string;
  languageCode: string;
  status: 'active' | 'completed';
  progressPercent: number;
  enrolledAt: Date;
  lastAccessedAt: Date;
  completedAt?: Date;
}

export interface LessonProgress {
  id: string;
  userId: string;
  courseId: string;
  lessonId: string;
  completed: boolean;
  progressPercent: number;
  /** Position inside the lesson for "continue where I stopped". */
  lastBlockIndex?: number;
  lastActivityId?: string;
  completedAt?: Date;
  updatedAt?: Date;
}

export interface QuizResult {
  id: string;
  userId: string;
  quizId: string;
  quizTitle: string;
  courseId: string;
  bestScorePercent: number;
  lastScorePercent: number;
  passed: boolean;
  attempts: number;
  passedAt?: Date;
  lastAttemptAt: Date;
}

export interface EarnedBadge {
  code: string;
  earnedAt: Date;
}

export interface LearnerCounters {
  lessonsCompleted: number;
  activitiesCompleted: number;
  quizzesPassed: number;
  gamesPlayed: number;
  gamecardScans: number;
  culturalTopicsCompleted: number;
  coursesCompleted: number;
}

export interface LearnerStats {
  id: string;
  userId: string;
  totalPoints: number;
  currentStreakDays: number;
  longestStreakDays: number;
  /** YYYY-MM-DD (UTC) of the last meaningful learning activity. */
  lastActiveDate?: string;
  totalLearningSeconds: number;
  lastHeartbeatAt?: Date;
  badges: EarnedBadge[];
  counters: LearnerCounters;
  languagesStarted: string[];
}

export enum LearningEventType {
  LESSON_COMPLETED = 'lesson_completed',
  ACTIVITY_COMPLETED = 'activity_completed',
  QUIZ_ATTEMPTED = 'quiz_attempted',
  QUIZ_PASSED = 'quiz_passed',
  GAMECARD_SCANNED = 'gamecard_scanned',
  GAME_PLAYED = 'game_played',
  CULTURAL_TOPIC_COMPLETED = 'cultural_topic_completed',
  COURSE_ENROLLED = 'course_enrolled',
  COURSE_COMPLETED = 'course_completed',
  BADGE_EARNED = 'badge_earned',
  STREAK_EXTENDED = 'streak_extended',
}

/** Append-only activity feed + points ledger. */
export interface LearningEvent {
  id: string;
  userId: string;
  type: LearningEventType;
  points: number;
  courseId?: string;
  lessonId?: string;
  refId?: string;
  meta?: Record<string, unknown>;
  at: Date;
}

export const EMPTY_COUNTERS: LearnerCounters = {
  lessonsCompleted: 0,
  activitiesCompleted: 0,
  quizzesPassed: 0,
  gamesPlayed: 0,
  gamecardScans: 0,
  culturalTopicsCompleted: 0,
  coursesCompleted: 0,
};
