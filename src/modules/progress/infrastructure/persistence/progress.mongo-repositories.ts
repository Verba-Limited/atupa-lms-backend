import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, mongo } from 'mongoose';
import {
  toEntities,
  toEntity,
} from '../../../../shared/infrastructure/mongo/mongo-mapper';
import type {
  ActivityCompletionRepository,
  CourseEnrollmentStats,
  EnrollmentRepository,
  LearnerStatsRepository,
  LearningEventRepository,
  LessonProgressRepository,
  QuizResultRepository,
  StatsDelta,
} from '../../application/ports/progress.repositories.port';
import { StreakUpdate } from '../../domain/gamification.rules';
import {
  EMPTY_COUNTERS,
  Enrollment,
  LearnerStats,
  LearningEvent,
  LearningEventType,
  LessonProgress,
  QuizResult,
} from '../../domain/progress.entities';
import {
  ActivityCompletionRecord,
  EnrollmentRecord,
  LearnerStatsRecord,
  LearningEventRecord,
  LessonProgressRecord,
  QuizResultRecord,
} from './progress.schemas';

const AFTER = { returnDocument: 'after' as const };

function isDuplicateKey(error: unknown): boolean {
  return error instanceof mongo.MongoServerError && error.code === 11000;
}

@Injectable()
export class EnrollmentMongoRepository implements EnrollmentRepository {
  constructor(
    @InjectModel(EnrollmentRecord.name)
    private readonly model: Model<EnrollmentRecord>,
  ) {}

  async find(userId: string, courseId: string) {
    return toEntity<Enrollment>(
      await this.model.findOne({ userId, courseId }).lean().exec(),
    );
  }

  async touch(userId: string, courseId: string, languageCode: string) {
    const now = new Date();
    const res = await this.model
      .updateOne(
        { userId, courseId },
        {
          $set: { lastAccessedAt: now },
          $setOnInsert: {
            languageCode,
            status: 'active',
            progressPercent: 0,
            enrolledAt: now,
          },
        },
        { upsert: true },
      )
      .exec();
    const enrollment = (await this.find(userId, courseId)) as Enrollment;
    return { enrollment, created: res.upsertedCount > 0 };
  }

  async setProgress(
    userId: string,
    courseId: string,
    percent: number,
    completedAt?: Date,
  ) {
    await this.model
      .updateOne(
        { userId, courseId },
        {
          $set: {
            progressPercent: percent,
            ...(completedAt ? { status: 'completed', completedAt } : {}),
          },
        },
      )
      .exec();
  }

  async remove(userId: string, courseId: string) {
    const res = await this.model.deleteOne({ userId, courseId }).exec();
    return res.deletedCount > 0;
  }

  async listByUser(userId: string, status?: Enrollment['status']) {
    return toEntities<Enrollment>(
      await this.model
        .find({ userId, ...(status ? { status } : {}) })
        .sort({ lastAccessedAt: -1 })
        .lean()
        .exec(),
    );
  }

  async listByUsers(userIds: string[]) {
    return toEntities<Enrollment>(
      await this.model
        .find({ userId: { $in: userIds } })
        .lean()
        .exec(),
    );
  }

  async courseStats(filter: {
    userIds?: string[];
    limit: number;
  }): Promise<CourseEnrollmentStats[]> {
    const match = filter.userIds ? { userId: { $in: filter.userIds } } : {};
    const rows = await this.model
      .aggregate<{ _id: string; enrolled: number; completed: number }>([
        { $match: match },
        {
          $group: {
            _id: '$courseId',
            enrolled: { $sum: 1 },
            completed: {
              $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] },
            },
          },
        },
        { $sort: { enrolled: -1 } },
        { $limit: filter.limit },
      ])
      .exec();
    return rows.map((r) => ({
      courseId: r._id,
      enrolled: r.enrolled,
      completed: r.completed,
    }));
  }
}

@Injectable()
export class LessonProgressMongoRepository implements LessonProgressRepository {
  constructor(
    @InjectModel(LessonProgressRecord.name)
    private readonly model: Model<LessonProgressRecord>,
  ) {}

  async savePosition(
    userId: string,
    courseId: string,
    lessonId: string,
    position: {
      progressPercent?: number;
      lastBlockIndex?: number;
      lastActivityId?: string;
    },
  ) {
    const set: Record<string, unknown> = { courseId };
    if (position.lastBlockIndex !== undefined)
      set.lastBlockIndex = position.lastBlockIndex;
    if (position.lastActivityId !== undefined)
      set.lastActivityId = position.lastActivityId;
    const update: Record<string, unknown> = {
      $set: set,
      $setOnInsert: { completed: false },
    };
    if (position.progressPercent !== undefined) {
      update.$max = { progressPercent: position.progressPercent };
    }
    const doc = await this.model
      .findOneAndUpdate({ userId, lessonId }, update, {
        ...AFTER,
        upsert: true,
      })
      .lean()
      .exec();
    return toEntity<LessonProgress>(doc) as LessonProgress;
  }

  async markCompleted(userId: string, courseId: string, lessonId: string) {
    const now = new Date();
    try {
      const res = await this.model
        .updateOne(
          { userId, lessonId, completed: { $ne: true } },
          {
            $set: {
              courseId,
              completed: true,
              completedAt: now,
              progressPercent: 100,
            },
          },
          { upsert: true },
        )
        .exec();
      return res.modifiedCount > 0 || res.upsertedCount > 0;
    } catch (error) {
      // Upsert raced with an existing completed record.
      if (isDuplicateKey(error)) return false;
      throw error;
    }
  }

  async listByUserCourse(userId: string, courseId: string) {
    return toEntities<LessonProgress>(
      await this.model.find({ userId, courseId }).lean().exec(),
    );
  }

  async completedLessonIds(userId: string, courseId: string) {
    const docs = await this.model
      .find({ userId, courseId, completed: true }, { lessonId: 1 })
      .lean()
      .exec();
    return new Set(docs.map((d) => d.lessonId));
  }

  async latestForUser(userId: string) {
    return toEntity<LessonProgress>(
      await this.model
        .findOne({ userId })
        .sort({ updatedAt: -1 })
        .lean()
        .exec(),
    );
  }
}

@Injectable()
export class ActivityCompletionMongoRepository implements ActivityCompletionRepository {
  constructor(
    @InjectModel(ActivityCompletionRecord.name)
    private readonly model: Model<ActivityCompletionRecord>,
  ) {}

  async record(input: {
    userId: string;
    courseId: string;
    lessonId: string;
    activityId: string;
    correct: boolean;
  }): Promise<'new' | 'now_correct' | 'repeat'> {
    try {
      await this.model.create(input);
      return 'new';
    } catch (error) {
      if (!isDuplicateKey(error)) throw error;
    }
    if (!input.correct) return 'repeat';
    const res = await this.model
      .updateOne(
        { userId: input.userId, activityId: input.activityId, correct: false },
        { $set: { correct: true } },
      )
      .exec();
    return res.modifiedCount ? 'now_correct' : 'repeat';
  }

  countByUser(userId: string, courseId?: string) {
    return this.model
      .countDocuments({ userId, ...(courseId ? { courseId } : {}) })
      .exec();
  }
}

@Injectable()
export class QuizResultMongoRepository implements QuizResultRepository {
  constructor(
    @InjectModel(QuizResultRecord.name)
    private readonly model: Model<QuizResultRecord>,
  ) {}

  async record(input: {
    userId: string;
    quizId: string;
    quizTitle: string;
    courseId: string;
    scorePercent: number;
    passed: boolean;
  }) {
    const now = new Date();
    const before = await this.model
      .findOneAndUpdate(
        { userId: input.userId, quizId: input.quizId },
        {
          $set: {
            quizTitle: input.quizTitle,
            courseId: input.courseId,
            lastScorePercent: input.scorePercent,
            lastAttemptAt: now,
          },
          $max: { bestScorePercent: input.scorePercent },
          $inc: { attempts: 1 },
          ...(input.passed ? {} : { $setOnInsert: { passed: false } }),
        },
        { upsert: true, returnDocument: 'before' },
      )
      .lean()
      .exec();
    let firstPass = false;
    if (input.passed && !before?.passed) {
      const res = await this.model
        .updateOne(
          { userId: input.userId, quizId: input.quizId, passed: { $ne: true } },
          { $set: { passed: true, passedAt: now } },
        )
        .exec();
      firstPass = res.modifiedCount > 0;
    }
    return { firstPass };
  }

  async passedQuizIds(userId: string, courseId: string) {
    const docs = await this.model
      .find({ userId, courseId, passed: true }, { quizId: 1 })
      .lean()
      .exec();
    return new Set(docs.map((d) => d.quizId));
  }

  async listByUser(userId: string, limit: number) {
    return toEntities<QuizResult>(
      await this.model
        .find({ userId })
        .sort({ lastAttemptAt: -1 })
        .limit(limit)
        .lean()
        .exec(),
    );
  }

  async listByUsers(userIds: string[], limit: number) {
    return toEntities<QuizResult>(
      await this.model
        .find({ userId: { $in: userIds } })
        .sort({ lastAttemptAt: -1 })
        .limit(limit)
        .lean()
        .exec(),
    );
  }

  async averageBestScore(userIds: string[]) {
    const [row] = await this.model
      .aggregate<{ average: number; count: number }>([
        { $match: { userId: { $in: userIds } } },
        {
          $group: {
            _id: null,
            average: { $avg: '$bestScorePercent' },
            count: { $sum: 1 },
          },
        },
      ])
      .exec();
    return { average: Math.round(row?.average ?? 0), count: row?.count ?? 0 };
  }
}

function toStats(doc: unknown, userId: string): LearnerStats {
  const entity = toEntity<LearnerStats>(doc as never);
  if (!entity) {
    return {
      id: '',
      userId,
      totalPoints: 0,
      currentStreakDays: 0,
      longestStreakDays: 0,
      totalLearningSeconds: 0,
      badges: [],
      counters: { ...EMPTY_COUNTERS },
      languagesStarted: [],
    };
  }
  return { ...entity, counters: { ...EMPTY_COUNTERS, ...entity.counters } };
}

@Injectable()
export class LearnerStatsMongoRepository implements LearnerStatsRepository {
  constructor(
    @InjectModel(LearnerStatsRecord.name)
    private readonly model: Model<LearnerStatsRecord>,
  ) {}

  async get(userId: string) {
    return toStats(await this.model.findOne({ userId }).lean().exec(), userId);
  }

  async findByUsers(userIds: string[]) {
    const docs = await this.model
      .find({ userId: { $in: userIds } })
      .lean()
      .exec();
    return docs.map((d) => toStats(d, d.userId));
  }

  async applyDelta(userId: string, delta: StatsDelta) {
    const inc: Record<string, number> = {};
    if (delta.points) inc.totalPoints = delta.points;
    if (delta.learningSeconds) inc.totalLearningSeconds = delta.learningSeconds;
    for (const [key, value] of Object.entries(delta.counters ?? {})) {
      if (value) inc[`counters.${key}`] = value;
    }
    const doc = await this.model
      .findOneAndUpdate(
        { userId },
        Object.keys(inc).length ? { $inc: inc } : { $setOnInsert: { userId } },
        { ...AFTER, upsert: true },
      )
      .lean()
      .exec();
    return toStats(doc, userId);
  }

  async setStreak(
    userId: string,
    expectedLastDate: string | undefined,
    streak: StreakUpdate,
  ) {
    const res = await this.model
      .updateOne(
        { userId, lastActiveDate: expectedLastDate ?? { $exists: false } },
        {
          $set: {
            currentStreakDays: streak.currentStreakDays,
            longestStreakDays: streak.longestStreakDays,
            lastActiveDate: streak.lastActiveDate,
          },
        },
      )
      .exec();
    return res.modifiedCount > 0;
  }

  async addBadge(userId: string, code: string) {
    const res = await this.model
      .updateOne(
        { userId, 'badges.code': { $ne: code } },
        { $push: { badges: { code, earnedAt: new Date() } } },
      )
      .exec();
    return res.modifiedCount > 0;
  }

  async addLanguage(userId: string, languageCode: string) {
    await this.model
      .updateOne(
        { userId },
        { $addToSet: { languagesStarted: languageCode } },
        { upsert: true },
      )
      .exec();
  }

  async setHeartbeat(userId: string, at: Date) {
    await this.model
      .updateOne(
        { userId },
        { $set: { lastHeartbeatAt: at } },
        { upsert: true },
      )
      .exec();
  }

  async findUserIdsWithStreakOn(date: string, limit: number) {
    const docs = await this.model
      .find(
        { lastActiveDate: date, currentStreakDays: { $gte: 1 } },
        { userId: 1 },
      )
      .limit(limit)
      .lean()
      .exec();
    return docs.map((d) => d.userId);
  }
}

@Injectable()
export class LearningEventMongoRepository implements LearningEventRepository {
  constructor(
    @InjectModel(LearningEventRecord.name)
    private readonly model: Model<LearningEventRecord>,
  ) {}

  async append(event: Omit<LearningEvent, 'id'>) {
    await this.model.create(event);
  }

  async listByUser(userId: string, limit: number) {
    return toEntities<LearningEvent>(
      await this.model
        .find({ userId })
        .sort({ at: -1 })
        .limit(limit)
        .lean()
        .exec(),
    );
  }

  async listByUsers(userIds: string[], limit: number) {
    return toEntities<LearningEvent>(
      await this.model
        .find({ userId: { $in: userIds } })
        .sort({ at: -1 })
        .limit(limit)
        .lean()
        .exec(),
    );
  }

  async countByType(filter: { since?: Date; userIds?: string[] }) {
    const rows = await this.model
      .aggregate<{ _id: string; count: number }>([
        { $match: this.match(filter) },
        { $group: { _id: '$type', count: { $sum: 1 } } },
      ])
      .exec();
    return Object.fromEntries(rows.map((r) => [r._id, r.count]));
  }

  async activeUsers(filter: { since: Date; userIds?: string[] }) {
    const users = await this.model
      .distinct('userId', this.match(filter))
      .exec();
    return users.length;
  }

  async pointsLeaderboard(filter: {
    since?: Date;
    userIds?: string[];
    limit: number;
  }) {
    const rows = await this.model
      .aggregate<{ _id: string; points: number }>([
        { $match: { ...this.match(filter), points: { $gt: 0 } } },
        { $group: { _id: '$userId', points: { $sum: '$points' } } },
        { $sort: { points: -1 } },
        { $limit: filter.limit },
      ])
      .exec();
    return rows.map((r) => ({ userId: r._id, points: r.points }));
  }

  countByTypeForUser(userId: string, types: LearningEventType[]) {
    return this.model.countDocuments({ userId, type: { $in: types } }).exec();
  }

  async exists(userId: string, type: LearningEventType, refId: string) {
    return !!(await this.model.exists({ userId, type, refId }).exec());
  }

  private match(filter: {
    since?: Date;
    userIds?: string[];
  }): Record<string, unknown> {
    const match: Record<string, unknown> = {};
    if (filter.since) match.at = { $gte: filter.since };
    if (filter.userIds) match.userId = { $in: filter.userIds };
    return match;
  }
}
