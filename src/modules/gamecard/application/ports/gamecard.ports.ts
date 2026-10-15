import { Page, PageRequest } from '../../../../shared/domain/pagination';
import { GameCard, PlayKind, PlayRecord } from '../../domain/gamecard.entities';

export const GAMECARD_REPOSITORY = Symbol('GAMECARD_REPOSITORY');
export const PLAY_RECORD_REPOSITORY = Symbol('PLAY_RECORD_REPOSITORY');

export interface GameCardRepository {
  create(input: Omit<GameCard, 'id'>): Promise<GameCard>;
  findByCode(code: string): Promise<GameCard | null>;
  updateByCode(
    code: string,
    patch: Partial<GameCard>,
  ): Promise<GameCard | null>;
  deleteByCode(code: string): Promise<boolean>;
  list(
    filter: { languageCode?: string; conceptKey?: string },
    page: PageRequest,
  ): Promise<Page<GameCard>>;
}

export interface PlayRecordRepository {
  /**
   * Inserts the record. `rewarded` is set to true only when no rewarded
   * record exists for (user, kind, ref, day) — enforced by a unique index.
   */
  record(
    input: Omit<PlayRecord, 'id' | 'rewarded'>,
    wantsReward: boolean,
  ): Promise<PlayRecord>;
  listByUser(
    userId: string,
    kind: PlayKind | undefined,
    page: PageRequest,
  ): Promise<Page<PlayRecord>>;
  count(filter: {
    kind?: PlayKind;
    since?: Date;
    userIds?: string[];
  }): Promise<number>;
}
