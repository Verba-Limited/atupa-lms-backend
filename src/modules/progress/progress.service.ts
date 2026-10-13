import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  LearnerProgress,
  LearnerProgressDocument,
} from './schemas/learner-progress.schema';

const POINTS = {
  LESSON_COMPLETE: 20,
  QUIZ_PASS: 30,
  ACTIVITY_COMPLETE: 10,
  GAMECARD_SCAN: 5,
};

@Injectable()
export class ProgressService {
  constructor(
    @InjectModel(LearnerProgress.name)
    private readonly progressModel: Model<LearnerProgress>,
  ) {}

  async getOrCreate(userId: string): Promise<LearnerProgressDocument> {
    const existing = await this.progressModel.findOne({ userId }).exec();
    if (existing) return existing;
    return this.progressModel.create({ userId });
  }

  async getDashboard(userId: string) {
    const progress = await this.getOrCreate(userId);
    return {
      welcomeMessage: 'Kaabo! Welcome back to ATUPA LMS.',
      totalPoints: progress.totalPoints,
      currentStreakDays: progress.currentStreakDays,
      earnedBadges: progress.earnedBadges,
      completedLessons: progress.lessons.filter((l) => l.completed).length,
      continueLearning: progress.continueLessonId
        ? {
            courseId: progress.continueCourseId,
            lessonId: progress.continueLessonId,
          }
        : null,
      recentActivities: progress.recentActivities.slice(-10).reverse(),
      totalLearningMinutes: progress.totalLearningMinutes,
      completedCourseIds: progress.completedCourseIds,
    };
  }

  async updateLessonProgress(input: {
    userId: string;
    courseId: string;
    lessonId: string;
    completed?: boolean;
    progressPercent?: number;
    lastBlockIndex?: number;
    lastActivityId?: string;
  }) {
    const progress = await this.getOrCreate(input.userId);
    const lessons = [...progress.lessons];
    const index = lessons.findIndex((l) => l.lessonId === input.lessonId);
    const wasCompleted = index >= 0 ? lessons[index].completed : false;
    const next = {
      lessonId: input.lessonId,
      completed: input.completed ?? lessons[index]?.completed ?? false,
      progressPercent: input.progressPercent ?? lessons[index]?.progressPercent ?? 0,
      lastBlockIndex: input.lastBlockIndex ?? lessons[index]?.lastBlockIndex,
      lastActivityId: input.lastActivityId ?? lessons[index]?.lastActivityId,
      completedAt:
        input.completed && !lessons[index]?.completed
          ? new Date()
          : lessons[index]?.completedAt,
    };

    if (index >= 0) lessons[index] = next;
    else lessons.push(next);

    progress.lessons = lessons;
    progress.continueCourseId = input.courseId;
    progress.continueLessonId = input.lessonId;
    this.applyStreak(progress);
    this.pushRecentActivity(progress, {
      type: input.completed ? 'lesson_completed' : 'lesson_progress',
      lessonId: input.lessonId,
      courseId: input.courseId,
    });

    if (input.completed && !wasCompleted) {
      progress.totalPoints += POINTS.LESSON_COMPLETE;
      this.awardBadge(progress, 'first_lesson');
    }

    await progress.save();
    return progress;
  }

  async recordActivityCompletion(input: {
    userId: string;
    lessonId: string;
    activityId: string;
    courseId: string;
  }) {
    const progress = await this.getOrCreate(input.userId);
    progress.totalPoints += POINTS.ACTIVITY_COMPLETE;
    this.applyStreak(progress);
    this.pushRecentActivity(progress, {
      type: 'activity_completed',
      ...input,
    });
    await progress.save();
    return progress;
  }

  async recordQuizResult(input: {
    userId: string;
    lessonId: string;
    scorePercent: number;
    passed: boolean;
    learningMinutes?: number;
  }) {
    const progress = await this.getOrCreate(input.userId);
    if (input.passed) {
      progress.totalPoints += POINTS.QUIZ_PASS;
      this.awardBadge(progress, 'quiz_master');
    }
    if (input.learningMinutes) {
      progress.totalLearningMinutes += input.learningMinutes;
    }
    this.applyStreak(progress);
    this.pushRecentActivity(progress, {
      type: 'quiz_attempt',
      lessonId: input.lessonId,
      scorePercent: input.scorePercent,
      passed: input.passed,
    });
    await progress.save();
    return progress;
  }

  async recordGamecardScan(userId: string, payload: Record<string, unknown>) {
    const progress = await this.getOrCreate(userId);
    progress.totalPoints += POINTS.GAMECARD_SCAN;
    this.applyStreak(progress);
    this.pushRecentActivity(progress, {
      type: 'gamecard_scan',
      ...payload,
    });
    await progress.save();
    return progress;
  }

  async markCourseComplete(userId: string, courseId: string) {
    const progress = await this.getOrCreate(userId);
    if (!progress.completedCourseIds.includes(courseId)) {
      progress.completedCourseIds.push(courseId);
      this.awardBadge(progress, 'course_graduate');
      await progress.save();
    }
    return progress;
  }

  getChildSummaries(childUserIds: string[]) {
    return this.progressModel.find({ userId: { $in: childUserIds } }).exec();
  }

  private applyStreak(progress: LearnerProgressDocument): void {
    const today = new Date().toISOString().slice(0, 10);
    if (progress.lastActivityDate === today) return;
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    progress.currentStreakDays =
      progress.lastActivityDate === yesterday
        ? progress.currentStreakDays + 1
        : 1;
    progress.lastActivityDate = today;
  }

  private pushRecentActivity(
    progress: LearnerProgressDocument,
    activity: Record<string, unknown>,
  ): void {
    progress.recentActivities.push({
      ...activity,
      at: new Date().toISOString(),
    });
    if (progress.recentActivities.length > 50) {
      progress.recentActivities = progress.recentActivities.slice(-50);
    }
  }

  private awardBadge(progress: LearnerProgressDocument, badgeCode: string): void {
    if (!progress.earnedBadges.includes(badgeCode)) {
      progress.earnedBadges.push(badgeCode);
    }
  }
}
