import { Inject, Injectable } from '@nestjs/common';
import { createHash, randomBytes } from 'crypto';
import type { EventBus } from '../../../shared/application/event-bus.port';
import { EVENT_BUS } from '../../../shared/application/event-bus.port';
import { UserDeleted, UserInvited } from '../../../shared/contracts/events';
import {
  ConflictError,
  NotFoundError,
  ValidationError,
} from '../../../shared/domain/errors';
import { mapPage, Page, PageRequest } from '../../../shared/domain/pagination';
import { UserRole } from '../../../shared/domain/user-role';
import { assertRequiredFields } from '../domain/registration-rules';
import { PublicUser, toPublicUser, User } from '../domain/user.entity';
import type { PasswordHasher } from './ports/password-hasher.port';
import { PASSWORD_HASHER } from './ports/password-hasher.port';
import type { UserFilter, UserRepository } from './ports/user.repository.port';
import { USER_REPOSITORY } from './ports/user.repository.port';

export interface ProfileInput {
  firstName?: string;
  lastName?: string;
  phone?: string;
  dateOfBirth?: Date;
  preferredLanguageCode?: string;
  profileImageUrl?: string;
  teachingExperienceYears?: number;
  languageSpecializations?: string[];
}

export interface InviteUserInput extends ProfileInput {
  email: string;
  role: UserRole;
  schoolId?: string | null;
  invitedByName?: string;
}

const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/**
 * Public facade of the identity module. Other modules use this service to
 * read users and manage memberships; they never touch the user collection.
 */
@Injectable()
export class UsersService {
  constructor(
    @Inject(USER_REPOSITORY) private readonly users: UserRepository,
    @Inject(PASSWORD_HASHER) private readonly hasher: PasswordHasher,
    @Inject(EVENT_BUS) private readonly events: EventBus,
  ) {}

  async getById(id: string): Promise<PublicUser> {
    const user = await this.users.findById(id);
    if (!user) throw new NotFoundError('User not found');
    return toPublicUser(user);
  }

  async findById(id: string): Promise<PublicUser | null> {
    const user = await this.users.findById(id);
    return user ? toPublicUser(user) : null;
  }

  async findByIds(ids: string[]): Promise<PublicUser[]> {
    return (await this.users.findByIds(ids)).map(toPublicUser);
  }

  async findByEmail(email: string): Promise<PublicUser | null> {
    const user = await this.users.findByEmail(email);
    return user ? toPublicUser(user) : null;
  }

  async list(filter: UserFilter, page: PageRequest): Promise<Page<PublicUser>> {
    return mapPage(await this.users.list(filter, page), toPublicUser);
  }

  countByRole(filter?: { schoolId?: string }) {
    return this.users.countByRole(filter);
  }

  countActiveSince(since: Date, filter?: { schoolId?: string }) {
    return this.users.countActiveSince(since, filter);
  }

  findIds(
    filter: UserFilter & { preferredLanguageCode?: string },
    limit = 5000,
  ): Promise<string[]> {
    return this.users.findIds(filter, limit);
  }

  async updateProfile(
    userId: string,
    input: ProfileInput,
  ): Promise<PublicUser> {
    const user = await this.requireUser(userId);
    const next = { ...user, ...stripUndefined(input) };
    assertRequiredFields(user.role, next);
    const updated = await this.users.update(userId, stripUndefined(input));
    return toPublicUser(updated as User);
  }

  /**
   * Creates an account on someone's behalf (school admin adding a teacher,
   * super admin adding a content creator). The account gets an unusable
   * random password and the invitee sets their own via an emailed link.
   * Authorisation is the caller's responsibility.
   */
  async invite(input: InviteUserInput): Promise<PublicUser> {
    const email = input.email.toLowerCase().trim();
    if (await this.users.findByEmail(email)) {
      throw new ConflictError('Email is already registered');
    }
    const { invitedByName, ...profile } = input;
    const token = randomBytes(32).toString('hex');
    const user = await this.users.create({
      ...stripUndefined(profile),
      email,
      role: input.role,
      languageSpecializations: input.languageSpecializations ?? [],
      schoolId: input.schoolId ?? null,
      passwordHash: await this.hasher.hash(randomBytes(32).toString('hex')),
      isActive: true,
      passwordResetTokenHash: hashToken(token),
      passwordResetExpiresAt: new Date(Date.now() + INVITE_TTL_MS),
    });
    await this.events.publish(
      new UserInvited(
        user.id,
        user.email,
        user.firstName,
        user.role,
        token,
        invitedByName,
      ),
    );
    return toPublicUser(user);
  }

  async setSchool(
    userId: string,
    schoolId: string | null,
  ): Promise<PublicUser> {
    await this.requireUser(userId);
    const updated = await this.users.update(userId, { schoolId });
    return toPublicUser(updated as User);
  }

  // ---- Super admin operations -------------------------------------------

  async adminUpdate(
    userId: string,
    patch: { role?: UserRole; isActive?: boolean; schoolId?: string | null },
    actorId: string,
  ): Promise<PublicUser> {
    if (userId === actorId && (patch.role || patch.isActive === false)) {
      throw new ValidationError(
        'You cannot change your own role or deactivate yourself',
      );
    }
    await this.requireUser(userId);
    const changes: Partial<User> = stripUndefined(patch);
    if (patch.isActive === false) changes.refreshTokenHash = null;
    const updated = await this.users.update(userId, changes);
    return toPublicUser(updated as User);
  }

  /**
   * Deletes an account by anonymising it: personal data is erased, the
   * account is deactivated and sessions revoked. Learning records stay
   * (anonymous) so class and school statistics remain consistent.
   */
  async deleteAccount(userId: string): Promise<void> {
    const user = await this.requireUser(userId);
    await this.users.update(userId, {
      email: `deleted-${userId}@deleted.atupa.invalid`,
      firstName: 'Deleted',
      lastName: 'user',
      phone: null,
      dateOfBirth: null,
      profileImageUrl: null,
      languageSpecializations: [],
      schoolId: null,
      isActive: false,
      refreshTokenHash: null,
      passwordResetTokenHash: null,
      passwordResetExpiresAt: null,
      passwordHash: await this.hasher.hash(randomBytes(32).toString('hex')),
    });
    await this.events.publish(new UserDeleted(userId, user.role));
  }

  async adminDelete(userId: string, actorId: string): Promise<void> {
    if (userId === actorId) {
      throw new ValidationError('You cannot delete your own account here');
    }
    await this.deleteAccount(userId);
  }

  private async requireUser(id: string): Promise<User> {
    const user = await this.users.findById(id);
    if (!user) throw new NotFoundError('User not found');
    return user;
  }
}

export function stripUndefined<T extends object>(input: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(input).filter(([, v]) => v !== undefined),
  ) as Partial<T>;
}
