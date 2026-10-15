import { Inject, Injectable } from '@nestjs/common';
import type { EventBus } from '../../../shared/application/event-bus.port';
import { EVENT_BUS } from '../../../shared/application/event-bus.port';
import { GamePublished } from '../../../shared/contracts/events';
import { ContentStatus } from '../../../shared/domain/enums';
import { NotFoundError } from '../../../shared/domain/errors';
import { Page, PageRequest } from '../../../shared/domain/pagination';
import {
  CulturalTopic,
  Game,
  VocabularyEntry,
} from '../domain/library.entities';
import type {
  CulturalTopicFilter,
  CulturalTopicRepository,
  GameFilter,
  GameRepository,
  VocabularyFilter,
  VocabularyRepository,
} from './ports/library.repositories.port';
import {
  CULTURAL_TOPIC_REPOSITORY,
  GAME_REPOSITORY,
  VOCABULARY_REPOSITORY,
} from './ports/library.repositories.port';

type Input<T> = Omit<T, 'id' | 'createdAt'>;

/**
 * Vocabulary bank, cultural education topics and the ATUPA games catalogue.
 * `publishedOnly` reads are for learners; unrestricted reads for the CMS.
 */
@Injectable()
export class LibraryService {
  constructor(
    @Inject(VOCABULARY_REPOSITORY)
    private readonly vocabulary: VocabularyRepository,
    @Inject(CULTURAL_TOPIC_REPOSITORY)
    private readonly topics: CulturalTopicRepository,
    @Inject(GAME_REPOSITORY) private readonly games: GameRepository,
    @Inject(EVENT_BUS) private readonly events: EventBus,
  ) {}

  // ---- Vocabulary -------------------------------------------------------------

  listVocabulary(
    filter: VocabularyFilter,
    page: PageRequest,
    publishedOnly = true,
  ) {
    return this.vocabulary.list(
      publishedOnly ? { ...filter, status: ContentStatus.PUBLISHED } : filter,
      page,
    );
  }

  async getVocabulary(
    id: string,
    publishedOnly = true,
  ): Promise<VocabularyEntry> {
    const entry = await this.vocabulary.findById(id);
    if (!entry || (publishedOnly && entry.status !== ContentStatus.PUBLISHED)) {
      throw new NotFoundError('Vocabulary entry not found');
    }
    return entry;
  }

  /** The same concept in every language, e.g. "lion". */
  async getConcept(conceptKey: string): Promise<VocabularyEntry[]> {
    const page = await this.vocabulary.list(
      { conceptKey, status: ContentStatus.PUBLISHED },
      { page: 1, limit: 50 },
    );
    return page.items;
  }

  findVocabularyByIds(ids: string[]) {
    return this.vocabulary.findByIds(ids);
  }

  createVocabulary(
    input: Partial<Input<VocabularyEntry>> &
      Pick<VocabularyEntry, 'languageCode' | 'term' | 'meaning' | 'conceptKey'>,
  ) {
    return this.vocabulary.create({
      tags: [],
      status: ContentStatus.PUBLISHED,
      ...input,
    });
  }

  async updateVocabulary(id: string, patch: Partial<Input<VocabularyEntry>>) {
    return this.requireFound(
      await this.vocabulary.update(id, patch),
      'Vocabulary entry',
    );
  }

  async deleteVocabulary(id: string) {
    if (!(await this.vocabulary.delete(id)))
      throw new NotFoundError('Vocabulary entry not found');
  }

  // ---- Cultural topics ------------------------------------------------------------

  listTopics(
    filter: CulturalTopicFilter,
    page: PageRequest,
    publishedOnly = true,
  ) {
    return this.topics.list(
      publishedOnly ? { ...filter, status: ContentStatus.PUBLISHED } : filter,
      page,
    );
  }

  async getTopic(id: string, publishedOnly = true): Promise<CulturalTopic> {
    const topic = await this.topics.findById(id);
    if (!topic || (publishedOnly && topic.status !== ContentStatus.PUBLISHED)) {
      throw new NotFoundError('Cultural topic not found');
    }
    return topic;
  }

  createTopic(
    input: Partial<Input<CulturalTopic>> &
      Pick<CulturalTopic, 'title' | 'category'>,
  ) {
    return this.topics.create({
      blocks: [],
      tags: [],
      status: ContentStatus.DRAFT,
      ...input,
    });
  }

  async updateTopic(id: string, patch: Partial<Input<CulturalTopic>>) {
    return this.requireFound(
      await this.topics.update(id, patch),
      'Cultural topic',
    );
  }

  async deleteTopic(id: string) {
    if (!(await this.topics.delete(id)))
      throw new NotFoundError('Cultural topic not found');
  }

  // ---- Games -------------------------------------------------------------------------

  listGames(
    filter: GameFilter,
    page: PageRequest,
    publishedOnly = true,
  ): Promise<Page<Game>> {
    return this.games.list(
      publishedOnly ? { ...filter, status: ContentStatus.PUBLISHED } : filter,
      page,
    );
  }

  async getGame(id: string, publishedOnly = true): Promise<Game> {
    const game = await this.games.findById(id);
    if (!game || (publishedOnly && game.status !== ContentStatus.PUBLISHED)) {
      throw new NotFoundError('Game not found');
    }
    return game;
  }

  async createGame(
    input: Partial<Input<Game>> & Pick<Game, 'title' | 'gameType'>,
  ) {
    const game = await this.games.create({
      languageCodes: [],
      conceptKeys: [],
      isPremium: false,
      status: ContentStatus.DRAFT,
      ...input,
    });
    await this.announceIfPublished(null, game);
    return game;
  }

  async updateGame(id: string, patch: Partial<Input<Game>>) {
    const before = await this.games.findById(id);
    const game = this.requireFound(await this.games.update(id, patch), 'Game');
    await this.announceIfPublished(before, game);
    return game;
  }

  async deleteGame(id: string) {
    if (!(await this.games.delete(id)))
      throw new NotFoundError('Game not found');
  }

  private async announceIfPublished(before: Game | null, after: Game) {
    if (
      after.status === ContentStatus.PUBLISHED &&
      before?.status !== ContentStatus.PUBLISHED
    ) {
      await this.events.publish(
        new GamePublished(after.id, after.title, after.languageCodes),
      );
    }
  }

  private requireFound<T>(value: T | null, label: string): T {
    if (!value) throw new NotFoundError(`${label} not found`);
    return value;
  }
}
