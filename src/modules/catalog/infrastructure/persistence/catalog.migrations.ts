import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { randomUUID } from 'crypto';
import { Connection } from 'mongoose';

/**
 * Idempotent upgrades for catalog data written by the first prototype:
 * - ObjectId references become strings (the new schemas store string ids)
 * - quiz questions get stable ids
 * - lesson.gamecardQrCode becomes lesson.gamecardCodes
 * - activities get their courseId
 * - courses get an owner type and visibility (ATUPA courses stay Public;
 *   teacher and school courses become Private, enrolled learners keep access)
 */
@Injectable()
export class CatalogMigrations implements OnModuleInit {
  private readonly logger = new Logger(CatalogMigrations.name);

  constructor(@InjectConnection() private readonly connection: Connection) {}

  async onModuleInit(): Promise<void> {
    const db = this.connection.db;
    if (!db) return;
    const stringify = async (collection: string, field: string) => {
      const res = await db
        .collection(collection)
        .updateMany({ [field]: { $type: 'objectId' } }, [
          { $set: { [field]: { $toString: `$${field}` } } },
        ]);
      if (res.modifiedCount) {
        this.logger.log(
          `Migrated ${res.modifiedCount} ${collection}.${field} refs`,
        );
      }
    };
    await stringify('learning_modules', 'courseId');
    await stringify('lessons', 'courseId');
    await stringify('lessons', 'moduleId');
    await stringify('activities', 'lessonId');
    await stringify('quizzes', 'lessonId');

    const legacyLessons = db.collection('lessons').find({
      gamecardQrCode: { $exists: true },
    });
    for await (const lesson of legacyLessons) {
      await db.collection('lessons').updateOne(
        { _id: lesson._id },
        {
          $addToSet: { gamecardCodes: lesson.gamecardQrCode as string },
          $unset: { gamecardQrCode: '' },
        },
      );
    }

    const activitiesWithoutCourse = db
      .collection('activities')
      .find({ courseId: { $exists: false } });
    for await (const activity of activitiesWithoutCourse) {
      const lesson = await db.collection('lessons').findOne({
        $expr: { $eq: [{ $toString: '$_id' }, activity.lessonId] },
      });
      if (lesson) {
        await db
          .collection('activities')
          .updateOne(
            { _id: activity._id },
            { $set: { courseId: lesson.courseId } },
          );
      }
    }

    const coursesWithoutOwner = db
      .collection('courses')
      .find({ ownerType: { $exists: false } });
    for await (const course of coursesWithoutOwner) {
      const creatorId = course.createdByUserId as string | undefined;
      const creator =
        creatorId && /^[a-f0-9]{24}$/i.test(creatorId)
          ? await db.collection('users').findOne({
              $expr: { $eq: [{ $toString: '$_id' }, creatorId] },
            })
          : null;
      const role = creator?.role as string | undefined;
      const byAtupa = !role
        ? !course.schoolId
        : ['super_admin', 'content_creator', 'support_admin'].includes(role);
      await db.collection('courses').updateOne(
        { _id: course._id },
        {
          $set: {
            ownerType: byAtupa
              ? 'atupa'
              : role === 'school_admin'
                ? 'school'
                : 'teacher',
            visibility: byAtupa ? 'public' : 'private',
          },
        },
      );
    }

    const quizzesWithoutIds = db.collection('quizzes').find({
      $or: [
        { 'questions.id': { $exists: false } },
        { courseId: { $exists: false } },
      ],
      questions: { $ne: [] },
    });
    for await (const quiz of quizzesWithoutIds) {
      const questions = (quiz.questions as Record<string, unknown>[]).map(
        (q) => ({
          ...q,
          id: (q.id as string) ?? randomUUID(),
          points: (q.points as number) ?? 1,
        }),
      );
      let courseId = quiz.courseId as string | undefined;
      if (!courseId && quiz.lessonId) {
        const lesson = await db.collection('lessons').findOne({
          $expr: { $eq: [{ $toString: '$_id' }, quiz.lessonId] },
        });
        courseId = lesson?.courseId as string | undefined;
      }
      await db
        .collection('quizzes')
        .updateOne(
          { _id: quiz._id },
          { $set: { questions, ...(courseId ? { courseId } : {}) } },
        );
    }
  }
}
