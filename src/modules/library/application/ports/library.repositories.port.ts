import { CrudPort } from '../../../../shared/application/crud.port';
import {
  ContentStatus,
  ProficiencyLevel,
} from '../../../../shared/domain/enums';
import { Page, PageRequest } from '../../../../shared/domain/pagination';
import {
  CulturalCategory,
  CulturalTopic,
  Game,
  GameType,
  VocabularyEntry,
} from '../../domain/library.entities';

export const VOCABULARY_REPOSITORY = Symbol('VOCABULARY_REPOSITORY');
export const CULTURAL_TOPIC_REPOSITORY = Symbol('CULTURAL_TOPIC_REPOSITORY');
export const GAME_REPOSITORY = Symbol('GAME_REPOSITORY');

export interface VocabularyFilter {
  languageCode?: string;
  conceptKey?: string;
  level?: ProficiencyLevel;
  category?: string;
  status?: ContentStatus;
  q?: string;
}

export interface CulturalTopicFilter {
  category?: CulturalCategory;
  languageCode?: string;
  ageGroup?: string;
  status?: ContentStatus;
  q?: string;
}

export interface GameFilter {
  languageCode?: string;
  gameType?: GameType;
  status?: ContentStatus;
  q?: string;
}

export interface VocabularyRepository extends CrudPort<VocabularyEntry> {
  list(
    filter: VocabularyFilter,
    page: PageRequest,
  ): Promise<Page<VocabularyEntry>>;
}

export interface CulturalTopicRepository extends CrudPort<CulturalTopic> {
  list(
    filter: CulturalTopicFilter,
    page: PageRequest,
  ): Promise<Page<CulturalTopic>>;
}

export interface GameRepository extends CrudPort<Game> {
  list(filter: GameFilter, page: PageRequest): Promise<Page<Game>>;
}
