import { Inject, Injectable } from '@nestjs/common';
import { createHash } from 'crypto';
import type { Actor } from '../../../shared/application/actor';
import { NotFoundError, ValidationError } from '../../../shared/domain/errors';
import { UserRole } from '../../../shared/domain/user-role';
import { randomCode } from '../../../shared/domain/random-code';
import { PublicUser, UsersService } from '../../identity';
import { LINK_CODE_TTL_MINUTES } from '../domain/parent-link.entities';
import type {
  LinkCodeRepository,
  ParentLinkRepository,
} from './ports/parents.ports';
import {
  LINK_CODE_REPOSITORY,
  PARENT_LINK_REPOSITORY,
} from './ports/parents.ports';

function hashCode(code: string): string {
  return createHash('sha256').update(code.trim().toUpperCase()).digest('hex');
}

@Injectable()
export class ParentsService {
  constructor(
    @Inject(PARENT_LINK_REPOSITORY)
    private readonly links: ParentLinkRepository,
    @Inject(LINK_CODE_REPOSITORY) private readonly codes: LinkCodeRepository,
    private readonly users: UsersService,
  ) {}

  /** Learner generates a code to give to their parent. */
  async createLinkCode(actor: Actor) {
    const code = randomCode(8);
    const expiresAt = new Date(Date.now() + LINK_CODE_TTL_MINUTES * 60_000);
    await this.codes.replaceForLearner(actor.userId, hashCode(code), expiresAt);
    return { code, expiresAt };
  }

  /** Parent redeems the learner's code. */
  async linkWithCode(actor: Actor, code: string): Promise<PublicUser> {
    const linkCode = await this.codes.consume(hashCode(code), new Date());
    if (!linkCode)
      throw new ValidationError('This code is invalid or has expired');
    const child = await this.users.findById(linkCode.learnerId);
    if (!child || child.role !== UserRole.LEARNER) {
      throw new NotFoundError('Learner account not found');
    }
    await this.links.link(actor.userId, child.id);
    return child;
  }

  async unlink(actor: Actor, childId: string): Promise<void> {
    if (!(await this.links.unlink(actor.userId, childId))) {
      throw new NotFoundError('This child is not linked to your account');
    }
  }

  async listChildren(parentId: string): Promise<PublicUser[]> {
    return this.users.findByIds(await this.links.childIds(parentId));
  }

  // ---- Facade for other modules -------------------------------------------

  isParentOf(parentId: string, childId: string): Promise<boolean> {
    return this.links.exists(parentId, childId);
  }

  listChildIds(parentId: string): Promise<string[]> {
    return this.links.childIds(parentId);
  }

  listParentIds(childId: string): Promise<string[]> {
    return this.links.parentIds(childId);
  }

  removeAllLinksFor(userId: string): Promise<void> {
    return this.links.removeAllFor(userId);
  }

  countLinkedParents(): Promise<number> {
    return this.links.countParents();
  }
}
