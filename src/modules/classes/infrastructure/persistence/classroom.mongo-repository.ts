import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { PageRequest } from '../../../../shared/domain/pagination';
import { randomCode } from '../../../../shared/domain/random-code';
import { MongoCrudRepository } from '../../../../shared/infrastructure/mongo/mongo-crud.repository';
import {
  isObjectId,
  toEntity,
} from '../../../../shared/infrastructure/mongo/mongo-mapper';
import type {
  ClassroomFilter,
  ClassroomRepository,
} from '../../application/ports/classroom.repository.port';
import { Classroom } from '../../domain/classroom.entity';
import { ClassroomRecord } from './classroom.schema';

@Injectable()
export class ClassroomMongoRepository
  extends MongoCrudRepository<Classroom>
  implements ClassroomRepository, OnModuleInit
{
  constructor(
    @InjectModel(ClassroomRecord.name) model: Model<ClassroomRecord>,
  ) {
    super(model);
  }

  /** Prototype classes had no join code. */
  async onModuleInit() {
    const legacy = await this.model
      .find({ joinCode: { $exists: false } })
      .lean<{ _id: unknown }[]>()
      .exec();
    for (const c of legacy) {
      await this.model
        .updateOne(
          { _id: c._id },
          { $set: { joinCode: randomCode(8), isArchived: false } },
        )
        .exec();
    }
  }

  list(filter: ClassroomFilter, page: PageRequest) {
    return this.paginateBy(toQuery(filter), page, { name: 1 });
  }

  listAll(filter: ClassroomFilter) {
    return this.findManyBy(toQuery(filter), { name: 1 }, 1000);
  }

  findByJoinCode(code: string) {
    return this.findOneBy({ joinCode: code });
  }

  addStudents(id: string, studentIds: string[]) {
    return this.mutate(id, {
      $addToSet: { studentUserIds: { $each: studentIds } },
    });
  }

  removeStudent(id: string, studentId: string) {
    return this.mutate(id, { $pull: { studentUserIds: studentId } });
  }

  addCourse(id: string, courseId: string) {
    return this.mutate(id, { $addToSet: { assignedCourseIds: courseId } });
  }

  removeCourse(id: string, courseId: string) {
    return this.mutate(id, { $pull: { assignedCourseIds: courseId } });
  }

  async removeUserFromSchoolClasses(schoolId: string, userId: string) {
    await this.model
      .updateMany({ schoolId }, { $pull: { studentUserIds: userId } })
      .exec();
  }

  count(filter: ClassroomFilter) {
    return this.model.countDocuments(toQuery(filter)).exec();
  }

  private async mutate(id: string, update: Record<string, unknown>) {
    if (!isObjectId(id)) return null;
    return toEntity<Classroom>(
      await this.model
        .findByIdAndUpdate(id, update, { returnDocument: 'after' })
        .lean()
        .exec(),
    );
  }
}

function toQuery(filter: ClassroomFilter): Record<string, unknown> {
  const query: Record<string, unknown> = {};
  if (filter.schoolId) query.schoolId = filter.schoolId;
  if (filter.teacherUserId) query.teacherUserId = filter.teacherUserId;
  if (filter.studentUserId) query.studentUserIds = filter.studentUserId;
  if (!filter.includeArchived) query.isArchived = { $ne: true };
  return query;
}
