import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { PageRequest } from '../../../../shared/domain/pagination';
import { MongoCrudRepository } from '../../../../shared/infrastructure/mongo/mongo-crud.repository';
import {
  paginate,
  toEntities,
  toEntity,
} from '../../../../shared/infrastructure/mongo/mongo-mapper';
import type {
  AssignmentRepository,
  SubmissionRepository,
} from '../../application/ports/assignment.ports';
import {
  Assignment,
  AssignmentStatus,
  AssignmentType,
  Submission,
} from '../../domain/assignment.entities';
import { AssignmentRecord, SubmissionRecord } from './assignment.schemas';

@Injectable()
export class AssignmentMongoRepository
  extends MongoCrudRepository<Assignment>
  implements AssignmentRepository
{
  constructor(
    @InjectModel(AssignmentRecord.name) model: Model<AssignmentRecord>,
  ) {
    super(model);
  }

  listByClass(classroomId: string, page: PageRequest, learnerId?: string) {
    return this.paginateBy(
      { classroomId, ...(learnerId ? { learnerIds: learnerId } : {}) },
      page,
      { createdAt: -1 },
    );
  }

  findByTarget(learnerId: string, type: AssignmentType, targetId: string) {
    return this.findManyBy({ learnerIds: learnerId, type, targetId });
  }

  count(filter: { classroomIds?: string[]; schoolId?: string }) {
    const query: Record<string, unknown> = {};
    if (filter.classroomIds) query.classroomId = { $in: filter.classroomIds };
    if (filter.schoolId) query.schoolId = filter.schoolId;
    return this.model.countDocuments(query).exec();
  }
}

@Injectable()
export class SubmissionMongoRepository implements SubmissionRepository {
  constructor(
    @InjectModel(SubmissionRecord.name)
    private readonly model: Model<SubmissionRecord>,
  ) {}

  async createMany(items: Omit<Submission, 'id'>[]) {
    if (items.length) await this.model.insertMany(items, { ordered: false });
  }

  async find(assignmentId: string, learnerId: string) {
    return toEntity<Submission>(
      await this.model.findOne({ assignmentId, learnerId }).lean().exec(),
    );
  }

  async listByAssignment(assignmentId: string) {
    return toEntities<Submission>(
      await this.model.find({ assignmentId }).lean().exec(),
    );
  }

  async listByAssignments(assignmentIds: string[]) {
    return toEntities<Submission>(
      await this.model
        .find({ assignmentId: { $in: assignmentIds } })
        .lean()
        .exec(),
    );
  }

  listByLearner(learnerId: string, page: PageRequest) {
    return paginate<Submission>(this.model, { learnerId }, page, {
      createdAt: -1,
    });
  }

  async listByLearners(learnerIds: string[], limit: number) {
    return toEntities<Submission>(
      await this.model
        .find({ learnerId: { $in: learnerIds } })
        .sort({ updatedAt: -1 })
        .limit(limit)
        .lean()
        .exec(),
    );
  }

  async transition(
    assignmentId: string,
    learnerId: string,
    fromStatuses: AssignmentStatus[],
    patch: Partial<Submission>,
  ) {
    return toEntity<Submission>(
      await this.model
        .findOneAndUpdate(
          { assignmentId, learnerId, status: { $in: fromStatuses } },
          { $set: patch },
          { returnDocument: 'after' },
        )
        .lean()
        .exec(),
    );
  }

  async deleteByAssignment(assignmentId: string) {
    await this.model.deleteMany({ assignmentId }).exec();
  }

  async countByStatus(filter: {
    assignmentIds?: string[];
    learnerIds?: string[];
  }) {
    const match: Record<string, unknown> = {};
    if (filter.assignmentIds)
      match.assignmentId = { $in: filter.assignmentIds };
    if (filter.learnerIds) match.learnerId = { $in: filter.learnerIds };
    const rows = await this.model
      .aggregate<{ _id: string; count: number }>([
        { $match: match },
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ])
      .exec();
    return Object.fromEntries(rows.map((r) => [r._id, r.count]));
  }
}
