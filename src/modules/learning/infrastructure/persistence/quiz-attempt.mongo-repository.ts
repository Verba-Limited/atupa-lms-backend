import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { MongoCrudRepository } from '../../../../shared/infrastructure/mongo/mongo-crud.repository';
import {
  toEntities,
  toEntity,
} from '../../../../shared/infrastructure/mongo/mongo-mapper';
import { QuizAttemptRepository } from '../../application/ports/quiz-attempt.repository.port';
import { QuizAttempt } from '../../domain/quiz-attempt.entity';
import { QuizAttemptRecord } from './quiz-attempt.schema';

@Injectable()
export class QuizAttemptMongoRepository
  extends MongoCrudRepository<QuizAttempt>
  implements QuizAttemptRepository
{
  constructor(
    @InjectModel(QuizAttemptRecord.name) model: Model<QuizAttemptRecord>,
  ) {
    super(model);
  }

  findInProgress(userId: string, quizId: string) {
    return this.findOneBy({ userId, quizId, status: 'in_progress' });
  }

  countFinished(userId: string, quizId: string) {
    return this.model
      .countDocuments({
        userId,
        quizId,
        status: { $in: ['submitted', 'expired'] },
      })
      .exec();
  }

  async finish(id: string, patch: Partial<QuizAttempt>) {
    return toEntity<QuizAttempt>(
      await this.model
        .findOneAndUpdate(
          { _id: id, status: 'in_progress' },
          { $set: patch },
          { returnDocument: 'after' },
        )
        .lean()
        .exec(),
    );
  }

  async list(
    filter: { userIds: string[]; quizId?: string; courseId?: string },
    limit: number,
  ) {
    const query: Record<string, unknown> = { userId: { $in: filter.userIds } };
    if (filter.quizId) query.quizId = filter.quizId;
    if (filter.courseId) query.courseId = filter.courseId;
    return toEntities<QuizAttempt>(
      await this.model
        .find(query)
        .sort({ startedAt: -1 })
        .limit(limit)
        .lean()
        .exec(),
    );
  }
}
