import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { PageRequest } from '../../../../shared/domain/pagination';
import { MongoCrudRepository } from '../../../../shared/infrastructure/mongo/mongo-crud.repository';
import { CertificateRepository } from '../../application/ports/certificate.ports';
import { Certificate } from '../../domain/certificate.entity';
import { CertificateRecord } from './certificate.schema';

@Injectable()
export class CertificateMongoRepository
  extends MongoCrudRepository<Certificate>
  implements CertificateRepository, OnModuleInit
{
  constructor(
    @InjectModel(CertificateRecord.name) model: Model<CertificateRecord>,
  ) {
    super(model);
  }

  /** Backfills certificates created before `status` existed. */
  async onModuleInit() {
    await this.model
      .updateMany({ status: { $exists: false } }, { $set: { status: 'valid' } })
      .exec();
  }

  findByUserAndCourse(userId: string, courseId: string) {
    return this.findOneBy({ userId, courseId, status: 'valid' });
  }

  findByVerificationCode(code: string) {
    return this.findOneBy({ verificationCode: code });
  }

  listByUsers(userIds: string[]) {
    return this.findManyBy({ userId: { $in: userIds } }, { completedAt: -1 });
  }

  list(
    filter: { courseId?: string; status?: Certificate['status'] },
    page: PageRequest,
  ) {
    const query: Record<string, unknown> = {};
    if (filter.courseId) query.courseId = filter.courseId;
    if (filter.status) query.status = filter.status;
    return this.paginateBy(query, page);
  }

  count(filter: { since?: Date; userIds?: string[] }) {
    const query: Record<string, unknown> = { status: 'valid' };
    if (filter.since) query.completedAt = { $gte: filter.since };
    if (filter.userIds) query.userId = { $in: filter.userIds };
    return this.model.countDocuments(query).exec();
  }
}
