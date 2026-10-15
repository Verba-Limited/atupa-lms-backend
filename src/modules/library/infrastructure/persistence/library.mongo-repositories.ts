import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { PageRequest } from '../../../../shared/domain/pagination';
import { containsPattern } from '../../../../shared/domain/text';
import { MongoCrudRepository } from '../../../../shared/infrastructure/mongo/mongo-crud.repository';
import type {
  CulturalTopicFilter,
  CulturalTopicRepository,
  GameFilter,
  GameRepository,
  VocabularyFilter,
  VocabularyRepository,
} from '../../application/ports/library.repositories.port';
import {
  CulturalTopic,
  Game,
  VocabularyEntry,
} from '../../domain/library.entities';
import {
  CulturalTopicRecord,
  GameRecord,
  VocabularyRecord,
} from './library.schemas';

@Injectable()
export class VocabularyMongoRepository
  extends MongoCrudRepository<VocabularyEntry>
  implements VocabularyRepository
{
  constructor(
    @InjectModel(VocabularyRecord.name) model: Model<VocabularyRecord>,
  ) {
    super(model);
  }

  list(filter: VocabularyFilter, page: PageRequest) {
    const query: Record<string, unknown> = {};
    if (filter.languageCode)
      query.languageCode = filter.languageCode.toLowerCase();
    if (filter.conceptKey) query.conceptKey = filter.conceptKey.toLowerCase();
    if (filter.level) query.level = filter.level;
    if (filter.category) query.category = filter.category;
    if (filter.status) query.status = filter.status;
    if (filter.q) {
      const p = containsPattern(filter.q);
      query.$or = [{ term: p }, { meaning: p }, { conceptKey: p }, { tags: p }];
    }
    return this.paginateBy(query, page, { conceptKey: 1, languageCode: 1 });
  }
}

@Injectable()
export class CulturalTopicMongoRepository
  extends MongoCrudRepository<CulturalTopic>
  implements CulturalTopicRepository
{
  constructor(
    @InjectModel(CulturalTopicRecord.name) model: Model<CulturalTopicRecord>,
  ) {
    super(model);
  }

  list(filter: CulturalTopicFilter, page: PageRequest) {
    const query: Record<string, unknown> = {};
    if (filter.category) query.category = filter.category;
    if (filter.languageCode) {
      query.languageCode = { $in: [filter.languageCode.toLowerCase(), null] };
    }
    if (filter.ageGroup)
      query.ageGroup = { $in: [filter.ageGroup, 'all', null] };
    if (filter.status) query.status = filter.status;
    if (filter.q) {
      const p = containsPattern(filter.q);
      query.$or = [{ title: p }, { summary: p }, { tags: p }, { category: p }];
    }
    return this.paginateBy(query, page, { title: 1 });
  }
}

@Injectable()
export class GameMongoRepository
  extends MongoCrudRepository<Game>
  implements GameRepository
{
  constructor(@InjectModel(GameRecord.name) model: Model<GameRecord>) {
    super(model);
  }

  list(filter: GameFilter, page: PageRequest) {
    const query: Record<string, unknown> = {};
    if (filter.languageCode)
      query.languageCodes = filter.languageCode.toLowerCase();
    if (filter.gameType) query.gameType = filter.gameType;
    if (filter.status) query.status = filter.status;
    if (filter.q) {
      const p = containsPattern(filter.q);
      query.$or = [{ title: p }, { description: p }, { conceptKeys: p }];
    }
    return this.paginateBy(query, page, { title: 1 });
  }
}
