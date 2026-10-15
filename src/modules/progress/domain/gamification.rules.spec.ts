import {
  displayedStreak,
  newlyEarnedBadges,
  nextStreak,
  POINTS,
  streakPoints,
} from './gamification.rules';
import { EMPTY_COUNTERS, LearnerStats } from './progress.entities';

const stats = (overrides: Partial<LearnerStats> = {}): LearnerStats => ({
  id: '1',
  userId: 'u',
  totalPoints: 0,
  currentStreakDays: 0,
  longestStreakDays: 0,
  totalLearningSeconds: 0,
  badges: [],
  counters: { ...EMPTY_COUNTERS },
  languagesStarted: [],
  ...overrides,
});

describe('learning streak', () => {
  it('extends on consecutive days and resets after a gap', () => {
    const s = stats({
      currentStreakDays: 3,
      longestStreakDays: 3,
      lastActiveDate: '2026-10-14',
    });
    expect(nextStreak(s, '2026-10-15')).toMatchObject({
      currentStreakDays: 4,
      longestStreakDays: 4,
      isNewDay: true,
    });
    expect(nextStreak(s, '2026-10-17')).toMatchObject({
      currentStreakDays: 1,
      longestStreakDays: 3,
      isNewDay: true,
    });
  });

  it('does not change twice in one day', () => {
    const s = stats({
      currentStreakDays: 2,
      longestStreakDays: 5,
      lastActiveDate: '2026-10-15',
    });
    expect(nextStreak(s, '2026-10-15')).toMatchObject({
      currentStreakDays: 2,
      isNewDay: false,
    });
  });

  it('handles month boundaries', () => {
    const s = stats({
      currentStreakDays: 1,
      longestStreakDays: 1,
      lastActiveDate: '2026-09-30',
    });
    expect(nextStreak(s, '2026-10-01').currentStreakDays).toBe(2);
  });

  it('awards daily points and a weekly bonus', () => {
    expect(
      streakPoints({
        currentStreakDays: 3,
        longestStreakDays: 3,
        lastActiveDate: 'x',
        isNewDay: true,
      }),
    ).toBe(POINTS.STREAK_DAY);
    expect(
      streakPoints({
        currentStreakDays: 7,
        longestStreakDays: 7,
        lastActiveDate: 'x',
        isNewDay: true,
      }),
    ).toBe(POINTS.STREAK_DAY + POINTS.STREAK_WEEK_BONUS);
    expect(
      streakPoints({
        currentStreakDays: 7,
        longestStreakDays: 7,
        lastActiveDate: 'x',
        isNewDay: false,
      }),
    ).toBe(0);
  });

  it('shows a lapsed streak as zero', () => {
    expect(
      displayedStreak(
        { currentStreakDays: 5, lastActiveDate: '2026-10-14' },
        '2026-10-15',
      ),
    ).toBe(5);
    expect(
      displayedStreak(
        { currentStreakDays: 5, lastActiveDate: '2026-10-12' },
        '2026-10-15',
      ),
    ).toBe(0);
  });
});

describe('badges', () => {
  it('awards each badge once when its criteria are met', () => {
    const s = stats({
      counters: { ...EMPTY_COUNTERS, lessonsCompleted: 1, quizzesPassed: 5 },
      languagesStarted: ['yoruba', 'igbo'],
      longestStreakDays: 7,
      badges: [{ code: 'first_lesson', earnedAt: new Date() }],
    });
    expect(
      newlyEarnedBadges(s)
        .map((b) => b.code)
        .sort(),
    ).toEqual(['language_explorer', 'quiz_master', 'seven_day_learner']);
  });
});
