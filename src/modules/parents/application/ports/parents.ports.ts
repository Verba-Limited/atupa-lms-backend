import { LinkCode, ParentLink } from '../../domain/parent-link.entities';

export const PARENT_LINK_REPOSITORY = Symbol('PARENT_LINK_REPOSITORY');
export const LINK_CODE_REPOSITORY = Symbol('LINK_CODE_REPOSITORY');

export interface ParentLinkRepository {
  link(parentId: string, childId: string): Promise<ParentLink>;
  unlink(parentId: string, childId: string): Promise<boolean>;
  exists(parentId: string, childId: string): Promise<boolean>;
  childIds(parentId: string): Promise<string[]>;
  parentIds(childId: string): Promise<string[]>;
  countParents(): Promise<number>;
  removeAllFor(userId: string): Promise<void>;
}

export interface LinkCodeRepository {
  replaceForLearner(
    learnerId: string,
    codeHash: string,
    expiresAt: Date,
  ): Promise<LinkCode>;
  /** Atomically consumes a valid, unexpired code. */
  consume(codeHash: string, now: Date): Promise<LinkCode | null>;
}
