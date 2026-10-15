import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Page, PageRequest } from '../../../../shared/domain/pagination';
import { containsPattern } from '../../../../shared/domain/text';
import { MongoCrudRepository } from '../../../../shared/infrastructure/mongo/mongo-crud.repository';
import type {
  UserFilter,
  UserRepository,
} from '../../application/ports/user.repository.port';
import { User } from '../../domain/user.entity';
import { UserRecord } from './user.schema';

@Injectable()
export class UserMongoRepository
  extends MongoCrudRepository<User>
  implements UserRepository
{
  constructor(@InjectModel(UserRecord.name) model: Model<UserRecord>) {
    super(model);
  }

  findByEmail(email: string): Promise<User | null> {
    return this.findOneBy({ email: email.toLowerCase().trim() });
  }

  findByPasswordResetTokenHash(hash: string): Promise<User | null> {
    return this.findOneBy({ passwordResetTokenHash: hash });
  }

  list(filter: UserFilter, page: PageRequest): Promise<Page<User>> {
    return this.paginateBy(this.toQuery(filter), page, { createdAt: -1 });
  }

  async countByRole(filter?: {
    schoolId?: string;
  }): Promise<Record<string, number>> {
    const match = filter?.schoolId ? { schoolId: filter.schoolId } : {};
    const rows = await this.model
      .aggregate<{ _id: string; count: number }>([
        { $match: match },
        { $group: { _id: '$role', count: { $sum: 1 } } },
      ])
      .exec();
    return Object.fromEntries(rows.map((r) => [r._id, r.count]));
  }

  countActiveSince(
    since: Date,
    filter?: { schoolId?: string },
  ): Promise<number> {
    return this.model
      .countDocuments({
        lastActiveAt: { $gte: since },
        ...(filter?.schoolId ? { schoolId: filter.schoolId } : {}),
      })
      .exec();
  }

  async findIds(
    filter: UserFilter & { preferredLanguageCode?: string },
    limit: number,
  ): Promise<string[]> {
    const query: Record<string, unknown> = this.toQuery(filter);
    if (filter.preferredLanguageCode) {
      query.preferredLanguageCode = filter.preferredLanguageCode;
    }
    const docs = await this.model
      .find(query, { _id: 1 })
      .limit(limit)
      .lean<{ _id: unknown }[]>()
      .exec();
    return docs.map((d) => String(d._id));
  }

  private toQuery(filter: UserFilter): Record<string, unknown> {
    const query: Record<string, unknown> = {};
    if (filter.role) query.role = filter.role;
    if (filter.schoolId) query.schoolId = filter.schoolId;
    if (filter.isActive !== undefined) query.isActive = filter.isActive;
    if (filter.q) {
      const pattern = containsPattern(filter.q);
      query.$or = [
        { email: pattern },
        { firstName: pattern },
        { lastName: pattern },
      ];
    }
    return query;
  }
}
