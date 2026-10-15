import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { PageRequest } from '../../../../shared/domain/pagination';
import { randomCode } from '../../../../shared/domain/random-code';
import { containsPattern, escapeRegex } from '../../../../shared/domain/text';
import { MongoCrudRepository } from '../../../../shared/infrastructure/mongo/mongo-crud.repository';
import { SchoolRepository } from '../../application/ports/school.repository.port';
import { School } from '../../domain/school.entity';
import { SchoolRecord } from './school.schema';

@Injectable()
export class SchoolMongoRepository
  extends MongoCrudRepository<School>
  implements SchoolRepository, OnModuleInit
{
  constructor(@InjectModel(SchoolRecord.name) model: Model<SchoolRecord>) {
    super(model);
  }

  /** Prototype schools had no join code / settings. */
  async onModuleInit() {
    const legacy = await this.model
      .find({ joinCode: { $exists: false } })
      .lean<{ _id: unknown }[]>()
      .exec();
    for (const school of legacy) {
      await this.model
        .updateOne(
          { _id: school._id },
          {
            $set: {
              joinCode: randomCode(8),
              isActive: true,
              settings: {
                leaderboardsEnabled: true,
                showLearnerNamesOnLeaderboards: false,
              },
            },
          },
        )
        .exec();
    }
  }

  findByJoinCode(code: string) {
    return this.findOneBy({ joinCode: code });
  }

  findByName(name: string) {
    return this.findOneBy({
      name: new RegExp(`^${escapeRegex(name.trim())}$`, 'i'),
    });
  }

  list(filter: { q?: string; isActive?: boolean }, page: PageRequest) {
    const query: Record<string, unknown> = {};
    if (filter.isActive !== undefined) query.isActive = filter.isActive;
    if (filter.q) {
      const p = containsPattern(filter.q);
      query.$or = [{ name: p }, { region: p }, { email: p }];
    }
    return this.paginateBy(query, page, { name: 1 });
  }

  count() {
    return this.model.countDocuments().exec();
  }
}
