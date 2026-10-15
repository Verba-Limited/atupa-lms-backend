import { LearnerStats } from './progress.entities';

/**
 * Points rules (PRD section 15). Values are placeholders until the PM
 * provides the final points table; they only need changing here.
 */
export const POINTS = {
  LESSON_COMPLETED: 20,
  ACTIVITY_CORRECT: 10,
  ACTIVITY_DONE: 5,
  QUIZ_PASSED: 30,
  GAMECARD_SCAN: 5,
  GAME_PLAYED: 15,
  CULTURAL_TOPIC: 10,
  COURSE_COMPLETED: 100,
  STREAK_DAY: 5,
  STREAK_WEEK_BONUS: 50,
} as const;

/** Learning-time heartbeats are capped to stop idle tabs farming time. */
export const MAX_HEARTBEAT_SECONDS = 300;

export interface BadgeDefinition {
  code: string;
  name: string;
  description: string;
  earned(stats: LearnerStats): boolean;
}

/** Badge catalogue (PRD section 15). Criteria are placeholders for the PM. */
export const BADGES: BadgeDefinition[] = [
  {
    code: 'first_lesson',
    name: 'First Lesson',
    description: 'Complete your first lesson',
    earned: (s) => s.counters.lessonsCompleted >= 1,
  },
  {
    code: 'vocabulary_starter',
    name: 'Vocabulary Starter',
    description: 'Complete 10 practice activities',
    earned: (s) => s.counters.activitiesCompleted >= 10,
  },
  {
    code: 'language_explorer',
    name: 'Language Explorer',
    description: 'Start courses in two different languages',
    earned: (s) => s.languagesStarted.length >= 2,
  },
  {
    code: 'quiz_master',
    name: 'Quiz Master',
    description: 'Pass 5 quizzes',
    earned: (s) => s.counters.quizzesPassed >= 5,
  },
  {
    code: 'culture_champion',
    name: 'Culture Champion',
    description: 'Complete 5 cultural topics',
    earned: (s) => s.counters.culturalTopicsCompleted >= 5,
  },
  {
    code: 'seven_day_learner',
    name: '7-Day Learner',
    description: 'Learn 7 days in a row',
    earned: (s) => s.longestStreakDays >= 7,
  },
  {
    code: 'atupa_champion',
    name: 'ATUPA Champion',
    description: 'Play 10 ATUPA games or GameCard challenges',
    earned: (s) => s.counters.gamesPlayed >= 10,
  },
  {
    code: 'course_graduate',
    name: 'Course Graduate',
    description: 'Complete a full course',
    earned: (s) => s.counters.coursesCompleted >= 1,
  },
];

export function badgeName(code: string): string {
  return BADGES.find((b) => b.code === code)?.name ?? code;
}

/** Badges whose criteria are met but which are not yet awarded. */
export function newlyEarnedBadges(stats: LearnerStats): BadgeDefinition[] {
  const owned = new Set(stats.badges.map((b) => b.code));
  return BADGES.filter((b) => !owned.has(b.code) && b.earned(stats));
}

export interface StreakUpdate {
  currentStreakDays: number;
  longestStreakDays: number;
  lastActiveDate: string;
  /** True on the first meaningful activity of a new day. */
  isNewDay: boolean;
}

/** Consecutive UTC days with at least one meaningful learning activity. */
export function nextStreak(
  stats: Pick<
    LearnerStats,
    'currentStreakDays' | 'longestStreakDays' | 'lastActiveDate'
  >,
  today: string,
): StreakUpdate {
  if (stats.lastActiveDate === today) {
    return {
      currentStreakDays: stats.currentStreakDays,
      longestStreakDays: stats.longestStreakDays,
      lastActiveDate: today,
      isNewDay: false,
    };
  }
  const yesterday = new Date(`${today}T00:00:00Z`);
  yesterday.setUTCDate(yesterday.getUTCDate() - 1);
  const continues =
    stats.lastActiveDate === yesterday.toISOString().slice(0, 10);
  const current = continues ? stats.currentStreakDays + 1 : 1;
  return {
    currentStreakDays: current,
    longestStreakDays: Math.max(stats.longestStreakDays, current),
    lastActiveDate: today,
    isNewDay: true,
  };
}

export function streakPoints(streak: StreakUpdate): number {
  if (!streak.isNewDay) return 0;
  const weekBonus =
    streak.currentStreakDays > 0 && streak.currentStreakDays % 7 === 0
      ? POINTS.STREAK_WEEK_BONUS
      : 0;
  return POINTS.STREAK_DAY + weekBonus;
}

/** The streak shown to users: a lapsed streak reads as 0. */
export function displayedStreak(
  stats: Pick<LearnerStats, 'currentStreakDays' | 'lastActiveDate'>,
  today: string,
): number {
  if (!stats.lastActiveDate) return 0;
  const gapDays =
    (Date.parse(`${today}T00:00:00Z`) -
      Date.parse(`${stats.lastActiveDate}T00:00:00Z`)) /
    86_400_000;
  return gapDays <= 1 ? stats.currentStreakDays : 0;
}
