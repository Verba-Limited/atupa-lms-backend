import { Inject, Injectable } from '@nestjs/common';
import type { EventBus } from '../../../shared/application/event-bus.port';
import { EVENT_BUS } from '../../../shared/application/event-bus.port';
import {
  BadgeEarned,
  CourseCompleted,
  LessonCompleted,
} from '../../../shared/contracts/events';
import { todayKey } from '../../../shared/domain/text';
import { CatalogQueryService } from '../../catalog';
import { LibraryService } from '../../library';
import { summarizeCourseProgress } from '../domain/course-completion.rules';
import {
  MAX_HEARTBEAT_SECONDS,
  newlyEarnedBadges,
  nextStreak,
  POINTS,
  streakPoints,
} from '../domain/gamification.rules';
import {
  LearnerCounters,
  LearnerStats,
  LearningEventType,
  LessonProgress,
} from '../domain/progress.entities';
import type {
  ActivityCompletionRepository,
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

interface Reward {
  type: LearningEventType;
  points: number;
  counters?: Partial<LearnerCounters>;
  courseId?: string;
  lessonId?: string;
  refId?: string;
  meta?: Record<string, unknown>;
  /** Whether this counts towards the daily learning streak. */
  meaningful?: boolean;
}

/**
 * Write side of learner progress and gamification. All point awards are
 * idempotent: repeated submissions never award points twice.
 */
@Injectable()
export class ProgressService {
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
    @Inject(EVENT_BUS) private readonly bus: EventBus,
    private readonly catalog: CatalogQueryService,
    private readonly library: LibraryService,
  ) {}

  async enroll(userId: string, courseId: string) {
    const course = await this.catalog.getPublishedCourse(courseId);
    const { enrollment, created } = await this.enrollments.touch(
      userId,
      courseId,
      course.languageCode,
    );
    if (created) {
      await this.stats.addLanguage(userId, course.languageCode);
      await this.reward(userId, {
        type: LearningEventType.COURSE_ENROLLED,
        points: 0,
        courseId,
        meta: { title: course.title },
        meaningful: false,
      });
    }
    return enrollment;
  }

  /** Saves the learner's position so another device can resume there. */
  async saveLessonPosition(
    userId: string,
    lessonId: string,
    position: {
      progressPercent?: number;
      lastBlockIndex?: number;
      lastActivityId?: string;
    },
  ): Promise<LessonProgress> {
    const { lesson } = await this.catalog.getLearnerLesson(lessonId);
    await this.enroll(userId, lesson.courseId);
    return this.lessons.savePosition(
      userId,
      lesson.courseId,
      lessonId,
      position,
    );
  }

  async completeLesson(userId: string, lessonId: string) {
    const { lesson } = await this.catalog.getLearnerLesson(lessonId);
    await this.enroll(userId, lesson.courseId);
    const firstTime = await this.lessons.markCompleted(
      userId,
      lesson.courseId,
      lessonId,
    );
    if (firstTime) {
      await this.reward(userId, {
        type: LearningEventType.LESSON_COMPLETED,
        points: POINTS.LESSON_COMPLETED,
        counters: { lessonsCompleted: 1 },
        courseId: lesson.courseId,
        lessonId,
        meta: { title: lesson.title },
      });
      await this.bus.publish(
        new LessonCompleted(userId, lesson.courseId, lessonId),
      );
      await this.checkCourseCompletion(userId, lesson.courseId);
    }
    return { lessonId, completed: true, firstTime };
  }

  async recordActivity(input: {
    userId: string;
    courseId: string;
    lessonId: string;
    activityId: string;
    correct: boolean;
  }): Promise<number> {
    const outcome = await this.activities.record(input);
    if (outcome === 'repeat') return 0;
    const points =
      outcome === 'new'
        ? input.correct
          ? POINTS.ACTIVITY_CORRECT
          : POINTS.ACTIVITY_DONE
        : POINTS.ACTIVITY_CORRECT - POINTS.ACTIVITY_DONE;
    await this.reward(input.userId, {
      type: LearningEventType.ACTIVITY_COMPLETED,
      points,
      counters: outcome === 'new' ? { activitiesCompleted: 1 } : undefined,
      courseId: input.courseId,
      lessonId: input.lessonId,
      refId: input.activityId,
      meta: { correct: input.correct },
    });
    return points;
  }

  async recordQuizAttempt(input: {
    userId: string;
    quizId: string;
    quizTitle: string;
    courseId: string;
    lessonId?: string;
    scorePercent: number;
    passed: boolean;
    durationSeconds: number;
  }): Promise<void> {
    await this.enroll(input.userId, input.courseId).catch(() => undefined);
    const { firstPass } = await this.quizzes.record(input);
    if (input.durationSeconds > 0) {
      await this.stats.applyDelta(input.userId, {
        learningSeconds: Math.min(input.durationSeconds, 4 * 3600),
      });
    }
    await this.reward(input.userId, {
      type: firstPass
        ? LearningEventType.QUIZ_PASSED
        : LearningEventType.QUIZ_ATTEMPTED,
      points: firstPass ? POINTS.QUIZ_PASSED : 0,
      counters: firstPass ? { quizzesPassed: 1 } : undefined,
      courseId: input.courseId,
      lessonId: input.lessonId,
      refId: input.quizId,
      meta: {
        title: input.quizTitle,
        scorePercent: input.scorePercent,
        passed: input.passed,
      },
    });
    if (firstPass)
      await this.checkCourseCompletion(input.userId, input.courseId);
  }

  async recordGamecardScan(
    userId: string,
    cardCode: string,
    rewardable: boolean,
  ) {
    await this.reward(userId, {
      type: LearningEventType.GAMECARD_SCANNED,
      points: rewardable ? POINTS.GAMECARD_SCAN : 0,
      counters: { gamecardScans: 1 },
      refId: cardCode,
    });
  }

  async recordGamePlayed(
    userId: string,
    gameRef: string,
    scorePercent: number,
    durationSeconds: number,
    rewardable: boolean,
  ) {
    if (durationSeconds > 0) {
      await this.stats.applyDelta(userId, {
        learningSeconds: Math.min(durationSeconds, 2 * 3600),
      });
    }
    await this.reward(userId, {
      type: LearningEventType.GAME_PLAYED,
      points: rewardable ? POINTS.GAME_PLAYED : 0,
      counters: { gamesPlayed: 1 },
      refId: gameRef,
      meta: { scorePercent },
    });
  }

  async completeCulturalTopic(userId: string, topicId: string) {
    await this.library.getTopic(topicId);
    if (
      await this.events.exists(
        userId,
        LearningEventType.CULTURAL_TOPIC_COMPLETED,
        topicId,
      )
    ) {
      return { topicId, completed: true, firstTime: false };
    }
    await this.reward(userId, {
      type: LearningEventType.CULTURAL_TOPIC_COMPLETED,
      points: POINTS.CULTURAL_TOPIC,
      counters: { culturalTopicsCompleted: 1 },
      refId: topicId,
    });
    return { topicId, completed: true, firstTime: true };
  }

  /**
   * Adds learning time from client heartbeats. Each heartbeat is capped and
   * cannot exceed the wall-clock time since the previous one.
   */
  async recordLearningTime(
    userId: string,
    seconds: number,
  ): Promise<LearnerStats> {
    const now = new Date();
    const current = await this.stats.get(userId);
    const sinceLast = current.lastHeartbeatAt
      ? Math.floor(
          (now.getTime() - new Date(current.lastHeartbeatAt).getTime()) / 1000,
        )
      : MAX_HEARTBEAT_SECONDS;
    const credited = Math.max(
      0,
      Math.min(seconds, MAX_HEARTBEAT_SECONDS, sinceLast),
    );
    await this.stats.setHeartbeat(userId, now);
    return credited
      ? this.stats.applyDelta(userId, { learningSeconds: credited })
      : current;
  }

  private async checkCourseCompletion(
    userId: string,
    courseId: string,
  ): Promise<void> {
    const [requirements, completed, passed] = await Promise.all([
      this.catalog.getCourseRequirements(courseId),
      this.lessons.completedLessonIds(userId, courseId),
      this.quizzes.passedQuizIds(userId, courseId),
    ]);
    const summary = summarizeCourseProgress(requirements, completed, passed);
    const enrollment = await this.enrollments.find(userId, courseId);
    const alreadyCompleted = enrollment?.status === 'completed';
    await this.enrollments.setProgress(
      userId,
      courseId,
      summary.percent,
      summary.complete && !alreadyCompleted ? new Date() : undefined,
    );
    if (summary.complete && !alreadyCompleted) {
      await this.reward(userId, {
        type: LearningEventType.COURSE_COMPLETED,
        points: POINTS.COURSE_COMPLETED,
        counters: { coursesCompleted: 1 },
        courseId,
        meaningful: false,
      });
      await this.bus.publish(new CourseCompleted(userId, courseId));
    }
  }

  /** Records the event, applies points/counters, streak and badges. */
  private async reward(userId: string, reward: Reward): Promise<void> {
    const now = new Date();
    await this.events.append({
      userId,
      type: reward.type,
      points: reward.points,
      courseId: reward.courseId,
      lessonId: reward.lessonId,
      refId: reward.refId,
      meta: reward.meta,
      at: now,
    });
    let stats = await this.stats.applyDelta(userId, {
      points: reward.points,
      counters: reward.counters,
    });

    if (reward.meaningful !== false) {
      const streak = nextStreak(stats, todayKey(now));
      if (
        streak.isNewDay &&
        (await this.stats.setStreak(userId, stats.lastActiveDate, streak))
      ) {
        const bonus = streakPoints(streak);
        await this.events.append({
          userId,
          type: LearningEventType.STREAK_EXTENDED,
          points: bonus,
          meta: { days: streak.currentStreakDays },
          at: now,
        });
        stats = await this.stats.applyDelta(userId, { points: bonus });
      }
    }

    for (const badge of newlyEarnedBadges(stats)) {
      if (await this.stats.addBadge(userId, badge.code)) {
        await this.events.append({
          userId,
          type: LearningEventType.BADGE_EARNED,
          points: 0,
          refId: badge.code,
          meta: { name: badge.name },
          at: now,
        });
        await this.bus.publish(new BadgeEarned(userId, badge.code, badge.name));
      }
    }
  }
}
