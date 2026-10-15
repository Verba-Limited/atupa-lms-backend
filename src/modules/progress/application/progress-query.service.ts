import { Inject, Injectable } from '@nestjs/common';
import { todayKey } from '../../../shared/domain/text';
import { CatalogQueryService } from '../../catalog';
import {
  CourseProgressSummary,
  summarizeCourseProgress,
} from '../domain/course-completion.rules';
import { BADGES, displayedStreak } from '../domain/gamification.rules';
import {
  Enrollment,
  LearnerStats,
  LearningEvent,
  LearningEventType,
  QuizResult,
} from '../domain/progress.entities';
import type {
  ActivityCompletionRepository,
  CourseEnrollmentStats,
  EnrollmentRepository,
  LearnerStatsRepository,
  LearningEventRepository,
  LessonProgressRepository,
  QuizResultRepository,
} from './ports/progress.repositories.port';
import {
  ACTIVITY_COMPLETION_REPOSITORY,
  ENROLLMENT_REPOSITORY,
  LEARNER_STATS_REPOSITORY,
  LEARNING_EVENT_REPOSITORY,
  LESSON_PROGRESS_REPOSITORY,
  QUIZ_RESULT_REPOSITORY,
} from './ports/progress.repositories.port';

export interface LearnerStatsView extends LearnerStats {
  /** Current streak as displayed (0 once it has lapsed). */
  streakDays: number;
  learningMinutes: number;
}

export interface CourseProgressView extends CourseProgressSummary {
  courseId: string;
  activitiesCompleted: number;
  enrollment: Enrollment | null;
}

/** Read-side facade over learner progress, used by dashboards and reports. */
@Injectable()
export class ProgressQueryService {
  constructor(
    @Inject(ENROLLMENT_REPOSITORY)
    private readonly enrollments: EnrollmentRepository,
    @Inject(LESSON_PROGRESS_REPOSITORY)
    private readonly lessons: LessonProgressRepository,
    @Inject(ACTIVITY_COMPLETION_REPOSITORY)
    private readonly activities: ActivityCompletionRepository,
    @Inject(QUIZ_RESULT_REPOSITORY)
    private readonly quizzes: QuizResultRepository,
    @Inject(LEARNER_STATS_REPOSITORY)
    private readonly stats: LearnerStatsRepository,
    @Inject(LEARNING_EVENT_REPOSITORY)
    private readonly events: LearningEventRepository,
    private readonly catalog: CatalogQueryService,
  ) {}

  async getStats(userId: string): Promise<LearnerStatsView> {
    return this.toView(await this.stats.get(userId));
  }

  async getStatsForUsers(userIds: string[]): Promise<LearnerStatsView[]> {
    return (await this.stats.findByUsers(userIds)).map((s) => this.toView(s));
  }

  listEnrollments(userId: string, status?: Enrollment['status']) {
    return this.enrollments.listByUser(userId, status);
  }

  listEnrollmentsForUsers(userIds: string[]) {
    return this.enrollments.listByUsers(userIds);
  }

  async getCourseProgress(
    userId: string,
    courseId: string,
  ): Promise<CourseProgressView> {
    const [requirements, completed, passed, activitiesCompleted, enrollment] =
      await Promise.all([
        this.catalog.getCourseRequirements(courseId),
        this.lessons.completedLessonIds(userId, courseId),
        this.quizzes.passedQuizIds(userId, courseId),
        this.activities.countByUser(userId, courseId),
        this.enrollments.find(userId, courseId),
      ]);
    return {
      courseId,
      ...summarizeCourseProgress(requirements, completed, passed),
      activitiesCompleted,
      enrollment,
    };
  }

  listLessonProgress(userId: string, courseId: string) {
    return this.lessons.listByUserCourse(userId, courseId);
  }

  getContinueLearning(userId: string) {
    return this.lessons.latestForUser(userId);
  }

  listRecentEvents(userId: string, limit = 10): Promise<LearningEvent[]> {
    return this.events.listByUser(userId, limit);
  }

  listRecentEventsForUsers(userIds: string[], limit = 20) {
    return this.events.listByUsers(userIds, limit);
  }

  listQuizResults(userId: string, limit = 10): Promise<QuizResult[]> {
    return this.quizzes.listByUser(userId, limit);
  }

  listQuizResultsForUsers(userIds: string[], limit = 50) {
    return this.quizzes.listByUsers(userIds, limit);
  }

  averageQuizScore(userIds: string[]) {
    return this.quizzes.averageBestScore(userIds);
  }

  countEventsByType(filter: { since?: Date; userIds?: string[] }) {
    return this.events.countByType(filter);
  }

  countActiveLearners(filter: { since: Date; userIds?: string[] }) {
    return this.events.activeUsers(filter);
  }

  courseEnrollmentStats(filter: {
    userIds?: string[];
    limit: number;
  }): Promise<CourseEnrollmentStats[]> {
    return this.enrollments.courseStats(filter);
  }

  pointsLeaderboard(filter: {
    since?: Date;
    userIds?: string[];
    limit: number;
  }) {
    return this.events.pointsLeaderboard(filter);
  }

  gamesPlayedBy(userId: string) {
    return this.events.countByTypeForUser(userId, [
      LearningEventType.GAME_PLAYED,
      LearningEventType.GAMECARD_SCANNED,
    ]);
  }

  /** Learners whose streak ends unless they learn today. */
  learnersWithStreakAtRisk(limit = 5000): Promise<string[]> {
    const yesterday = new Date(Date.now() - 86_400_000);
    return this.stats.findUserIdsWithStreakOn(todayKey(yesterday), limit);
  }

  async badgeCatalog(userId: string) {
    const stats = await this.stats.get(userId);
    const earned = new Map(stats.badges.map((b) => [b.code, b.earnedAt]));
    return BADGES.map((b) => ({
      code: b.code,
      name: b.name,
      description: b.description,
      earned: earned.has(b.code),
      earnedAt: earned.get(b.code),
    }));
  }

  private toView(stats: LearnerStats): LearnerStatsView {
    return {
      ...stats,
      streakDays: displayedStreak(stats, todayKey()),
      learningMinutes: Math.round(stats.totalLearningSeconds / 60),
    };
  }
}
