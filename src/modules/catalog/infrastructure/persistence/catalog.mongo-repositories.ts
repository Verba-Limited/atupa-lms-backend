import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Page, PageRequest } from '../../../../shared/domain/pagination';
import { containsPattern } from '../../../../shared/domain/text';
import { MongoCrudRepository } from '../../../../shared/infrastructure/mongo/mongo-crud.repository';
import { objectIds } from '../../../../shared/infrastructure/mongo/mongo-mapper';
import type {
  ActivityRepository,
  CourseFilter,
  CourseRepository,
  LanguageRepository,
  LessonFilter,
  LessonRepository,
  ModuleRepository,
  QuizRepository,
} from '../../application/ports/catalog.repositories.port';
import { Activity } from '../../domain/activity.entity';
import { Course, CourseModule } from '../../domain/course.entity';
import { Language } from '../../domain/language.entity';
import { Lesson } from '../../domain/lesson.entity';
import { Quiz } from '../../domain/quiz.entity';
import {
  ActivityRecord,
  CourseModuleRecord,
  CourseRecord,
  LanguageRecord,
  LessonRecord,
  QuizRecord,
} from './catalog.schemas';

@Injectable()
export class LanguageMongoRepository
  extends MongoCrudRepository<Language>
  implements LanguageRepository
{
  constructor(@InjectModel(LanguageRecord.name) model: Model<LanguageRecord>) {
    super(model);
  }

  findByCode(code: string) {
    return this.findOneBy({ code: code.toLowerCase() });
  }

  list(includeInactive: boolean) {
    return this.findManyBy(includeInactive ? {} : { isActive: true }, {
      order: 1,
      name: 1,
    });
  }
}

@Injectable()
export class CourseMongoRepository
  extends MongoCrudRepository<Course>
  implements CourseRepository
{
  constructor(@InjectModel(CourseRecord.name) model: Model<CourseRecord>) {
    super(model);
  }

  list(filter: CourseFilter, page: PageRequest): Promise<Page<Course>> {
    return this.paginateBy(toCourseQuery(filter), page, { title: 1 });
  }

  count(filter: CourseFilter): Promise<number> {
    return this.model.countDocuments(toCourseQuery(filter)).exec();
  }

  async countByLanguage(filter: CourseFilter): Promise<Record<string, number>> {
    const rows = await this.model
      .aggregate<{ _id: string; count: number }>([
        { $match: toCourseQuery(filter) },
        { $group: { _id: '$languageCode', count: { $sum: 1 } } },
      ])
      .exec();
    return Object.fromEntries(rows.map((r) => [r._id, r.count]));
  }
}

function toCourseQuery(filter: CourseFilter): Record<string, unknown> {
  const query: Record<string, unknown> = {};
  if (filter.languageCode)
    query.languageCode = filter.languageCode.toLowerCase();
  if (filter.level) query.level = filter.level;
  if (filter.courseType) query.courseType = filter.courseType;
  if (filter.ageGroup) query.ageGroup = { $in: [filter.ageGroup, 'all'] };
  if (filter.maxDurationMinutes) {
    query.durationMinutes = { $lte: filter.maxDurationMinutes };
  }
  if (filter.isPremium !== undefined) query.isPremium = filter.isPremium;
  if (filter.status) query.status = filter.status;
  if (filter.createdByUserId) query.createdByUserId = filter.createdByUserId;
  if (filter.schoolId) query.schoolId = filter.schoolId;
  if (filter.excludeIds?.length)
    query._id = { $nin: objectIds(filter.excludeIds) };
  if (filter.q) {
    const pattern = containsPattern(filter.q);
    query.$or = [
      { title: pattern },
      { description: pattern },
      { tags: pattern },
    ];
  }
  return query;
}

@Injectable()
export class ModuleMongoRepository
  extends MongoCrudRepository<CourseModule>
  implements ModuleRepository
{
  constructor(
    @InjectModel(CourseModuleRecord.name) model: Model<CourseModuleRecord>,
  ) {
    super(model);
  }

  listByCourse(courseId: string) {
    return this.findManyBy({ courseId }, { order: 1, createdAt: 1 });
  }

  async deleteByCourse(courseId: string) {
    await this.model.deleteMany({ courseId }).exec();
  }
}

@Injectable()
export class LessonMongoRepository
  extends MongoCrudRepository<Lesson>
  implements LessonRepository
{
  constructor(@InjectModel(LessonRecord.name) model: Model<LessonRecord>) {
    super(model);
  }

  list(filter: LessonFilter, limit?: number) {
    return this.findManyBy(
      toLessonQuery(filter),
      { order: 1, createdAt: 1 },
      limit,
    );
  }

  async deleteMany(filter: LessonFilter) {
    await this.model.deleteMany(toLessonQuery(filter)).exec();
  }
}

function toLessonQuery(filter: LessonFilter): Record<string, unknown> {
  const query: Record<string, unknown> = {};
  if (filter.courseId) query.courseId = filter.courseId;
  if (filter.courseIds) query.courseId = { $in: filter.courseIds };
  if (filter.moduleId) query.moduleId = filter.moduleId;
  if (filter.status) query.status = filter.status;
  if (filter.gamecardCode) query.gamecardCodes = filter.gamecardCode;
  if (filter.q) {
    const pattern = containsPattern(filter.q);
    query.$or = [
      { title: pattern },
      { summary: pattern },
      { vocabulary: pattern },
      { culturalNotes: pattern },
    ];
  }
  return query;
}

@Injectable()
export class ActivityMongoRepository
  extends MongoCrudRepository<Activity>
  implements ActivityRepository
{
  constructor(@InjectModel(ActivityRecord.name) model: Model<ActivityRecord>) {
    super(model);
  }

  listByLessons(lessonIds: string[]) {
    return this.findManyBy(
      { lessonId: { $in: lessonIds } },
      { order: 1, createdAt: 1 },
    );
  }

  async deleteByLessons(lessonIds: string[]) {
    await this.model.deleteMany({ lessonId: { $in: lessonIds } }).exec();
  }
}

@Injectable()
export class QuizMongoRepository
  extends MongoCrudRepository<Quiz>
  implements QuizRepository
{
  constructor(@InjectModel(QuizRecord.name) model: Model<QuizRecord>) {
    super(model);
  }

  listByCourse(courseId: string) {
    return this.findManyBy({ courseId }, { createdAt: 1 });
  }

  listByLessons(lessonIds: string[]) {
    return this.findManyBy({ lessonId: { $in: lessonIds } }, { createdAt: 1 });
  }

  async deleteMany(filter: {
    courseId?: string;
    moduleId?: string;
    lessonIds?: string[];
  }) {
    const query: Record<string, unknown> = {};
    if (filter.courseId) query.courseId = filter.courseId;
    if (filter.moduleId) query.moduleId = filter.moduleId;
    if (filter.lessonIds) query.lessonId = { $in: filter.lessonIds };
    if (!Object.keys(query).length) return;
    await this.model.deleteMany(query).exec();
  }
}
