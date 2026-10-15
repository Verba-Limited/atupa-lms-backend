import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, mongo } from 'mongoose';
import { PageRequest } from '../../../../shared/domain/pagination';
import {
  paginate,
  toEntity,
} from '../../../../shared/infrastructure/mongo/mongo-mapper';
import type {
  GameCardRepository,
  PlayRecordRepository,
} from '../../application/ports/gamecard.ports';
import { GameCard, PlayKind, PlayRecord } from '../../domain/gamecard.entities';
import { GameCardRecord, PlayRecordRecord } from './gamecard.schemas';

@Injectable()
export class GameCardMongoRepository implements GameCardRepository {
  constructor(
    @InjectModel(GameCardRecord.name)
    private readonly model: Model<GameCardRecord>,
  ) {}

  async create(input: Omit<GameCard, 'id'>) {
    const doc = await this.model.create(input);
    return toEntity<GameCard>(doc.toObject()) as GameCard;
  }

  async findByCode(code: string) {
    return toEntity<GameCard>(await this.model.findOne({ code }).lean().exec());
  }

  async updateByCode(code: string, patch: Partial<GameCard>) {
    return toEntity<GameCard>(
      await this.model
        .findOneAndUpdate(
          { code },
          { $set: patch },
          { returnDocument: 'after' },
        )
        .lean()
        .exec(),
    );
  }

  async deleteByCode(code: string) {
    return (await this.model.deleteOne({ code }).exec()).deletedCount > 0;
  }

  list(
    filter: { languageCode?: string; conceptKey?: string },
    page: PageRequest,
  ) {
    const query: Record<string, unknown> = {};
    if (filter.languageCode)
      query.languageCode = filter.languageCode.toLowerCase();
    if (filter.conceptKey) query.conceptKey = filter.conceptKey.toLowerCase();
    return paginate<GameCard>(this.model, query, page, { code: 1 });
  }
}

@Injectable()
export class PlayRecordMongoRepository implements PlayRecordRepository {
  constructor(
    @InjectModel(PlayRecordRecord.name)
    private readonly model: Model<PlayRecordRecord>,
  ) {}

  async record(
    input: Omit<PlayRecord, 'id' | 'rewarded'>,
    wantsReward: boolean,
  ) {
    if (wantsReward) {
      try {
        const doc = await this.model.create({ ...input, rewarded: true });
        return toEntity<PlayRecord>(doc.toObject()) as PlayRecord;
      } catch (error) {
        if (!(error instanceof mongo.MongoServerError && error.code === 11000))
          throw error;
      }
    }
    const doc = await this.model.create({ ...input, rewarded: false });
    return toEntity<PlayRecord>(doc.toObject()) as PlayRecord;
  }

  listByUser(userId: string, kind: PlayKind | undefined, page: PageRequest) {
    return paginate<PlayRecord>(
      this.model,
      { userId, ...(kind ? { kind } : {}) },
      page,
      { at: -1 },
    );
  }

  count(filter: { kind?: PlayKind; since?: Date; userIds?: string[] }) {
    const query: Record<string, unknown> = {};
    if (filter.kind) query.kind = filter.kind;
    if (filter.since) query.at = { $gte: filter.since };
    if (filter.userIds) query.userId = { $in: filter.userIds };
    return this.model.countDocuments(query).exec();
  }
}
