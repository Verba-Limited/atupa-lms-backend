import { Inject, Injectable } from '@nestjs/common';
import { createHash, randomBytes } from 'crypto';
import type { EventBus } from '../../../shared/application/event-bus.port';
import { EVENT_BUS } from '../../../shared/application/event-bus.port';
import {
  PasswordResetRequested,
  UserDeleted,
  UserInvited,
  VerificationDecided,
} from '../../../shared/contracts/events';
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from '../../../shared/domain/errors';
import { mapPage, Page, PageRequest } from '../../../shared/domain/pagination';
import { UserRole } from '../../../shared/domain/user-role';
import { assertRequiredFields } from '../domain/registration-rules';
import {
  initialVerificationStatus,
  PublicUser,
  toPublicUser,
  User,
  VerificationDocument,
  VerificationStatus,
  verificationStatusOf,
} from '../domain/user.entity';
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
const RESET_TTL_MS = 60 * 60 * 1000;

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
      verificationStatus: initialVerificationStatus(input.role),
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
    patch: ProfileInput & {
      role?: UserRole;
      isActive?: boolean;
      schoolId?: string | null;
    },
    actorId: string,
  ): Promise<PublicUser> {
    if (userId === actorId && (patch.role || patch.isActive === false)) {
      throw new ValidationError(
        'You cannot change your own role or deactivate yourself',
      );
    }
    const user = await this.requireUser(userId);
    if (
      user.role === UserRole.SUPER_ADMIN &&
      ((patch.role && patch.role !== UserRole.SUPER_ADMIN) ||
        patch.isActive === false)
    ) {
      await this.assertNotLastSuperAdmin(userId);
    }
    const changes: Partial<User> = stripUndefined(patch);
    if (patch.role && patch.role !== user.role) {
      changes.verificationStatus = initialVerificationStatus(patch.role);
    }
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

  /**
   * Admin help with access (admins never see or set passwords): sends a fresh
   * "set your password" invite if the user never logged in, else a reset link.
   */
  async sendAccessLink(
    userId: string,
  ): Promise<{ sent: 'invite' | 'password_reset' }> {
    const user = await this.requireUser(userId);
    if (!user.isActive) {
      throw new ValidationError(
        'Reactivate this account before sending a link',
      );
    }
    const token = randomBytes(32).toString('hex');
    const invite = !user.lastLoginAt && !user.lastActiveAt;
    await this.users.update(userId, {
      passwordResetTokenHash: hashToken(token),
      passwordResetExpiresAt: new Date(
        Date.now() + (invite ? INVITE_TTL_MS : RESET_TTL_MS),
      ),
    });
    await this.events.publish(
      invite
        ? new UserInvited(
            user.id,
            user.email,
            user.firstName,
            user.role,
            token,
            'ATUPA Admin',
          )
        : new PasswordResetRequested(
            user.id,
            user.email,
            user.firstName,
            token,
          ),
    );
    return { sent: invite ? 'invite' : 'password_reset' };
  }

  /** Deactivates an account and signs it out everywhere. */
  async suspend(userId: string): Promise<PublicUser> {
    await this.requireUser(userId);
    const updated = await this.users.update(userId, {
      isActive: false,
      refreshTokenHash: null,
    });
    return toPublicUser(updated as User);
  }

  // ---- Teacher verification -----------------------------------------------

  /** A teacher sends ID or certificate scans for ATUPA to check. */
  async submitVerification(
    userId: string,
    documents: VerificationDocument[],
    note?: string,
  ): Promise<PublicUser> {
    const user = await this.requireUser(userId);
    if (user.role !== UserRole.TEACHER) {
      throw new ForbiddenError('Only teachers submit verification documents');
    }
    if (verificationStatusOf(user) === VerificationStatus.VERIFIED) {
      throw new ConflictError('Your account is already verified');
    }
    if (!documents.length) {
      throw new ValidationError('Attach at least one document');
    }
    const updated = await this.users.update(userId, {
      verificationStatus: VerificationStatus.PENDING,
      verificationDocuments: documents,
      verificationNote: note ?? null,
      verificationSubmittedAt: new Date(),
    });
    return toPublicUser(updated as User);
  }

  /**
   * Super admin decision. Approval verifies the teacher. Rejection marks the
   * account as unauthorised and blocks sign-in until an admin reactivates it.
   */
  async decideVerification(
    userId: string,
    approve: boolean,
    actorId: string,
    reason?: string,
  ): Promise<PublicUser> {
    const user = await this.requireUser(userId);
    if (user.role !== UserRole.TEACHER) {
      throw new ValidationError('Only teacher accounts need verification');
    }
    if (!approve && !reason) {
      throw new ValidationError('Give a reason when rejecting');
    }
    const updated = await this.users.update(userId, {
      verificationStatus: approve
        ? VerificationStatus.VERIFIED
        : VerificationStatus.REJECTED,
      verifiedAt: approve ? new Date() : null,
      verifiedByUserId: actorId,
      ...(approve
        ? { isActive: true }
        : {
            verificationNote: reason,
            isActive: false,
            refreshTokenHash: null,
          }),
    });
    await this.events.publish(
      new VerificationDecided('user', userId, userId, approve, reason),
    );
    return toPublicUser(updated as User);
  }

  async adminDelete(userId: string, actorId: string): Promise<void> {
    if (userId === actorId) {
      throw new ValidationError('You cannot delete your own account here');
    }
    const user = await this.requireUser(userId);
    if (user.role === UserRole.SUPER_ADMIN) {
      await this.assertNotLastSuperAdmin(userId);
    }
    await this.deleteAccount(userId);
  }

  private async assertNotLastSuperAdmin(userId: string): Promise<void> {
    const others = await this.users.list(
      { role: UserRole.SUPER_ADMIN, isActive: true },
      { page: 1, limit: 2 },
    );
    if (!others.items.some((u) => u.id !== userId)) {
      throw new ValidationError('You cannot remove the last super admin');
    }
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
