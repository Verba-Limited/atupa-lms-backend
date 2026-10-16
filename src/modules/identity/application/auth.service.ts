import { Inject, Injectable } from '@nestjs/common';
import { randomBytes, timingSafeEqual } from 'crypto';
import type { EventBus } from '../../../shared/application/event-bus.port';
import { EVENT_BUS } from '../../../shared/application/event-bus.port';
import { PasswordResetRequested } from '../../../shared/contracts/events';
import {
  ConflictError,
  ForbiddenError,
  UnauthorizedError,
  ValidationError,
} from '../../../shared/domain/errors';
import {
  SELF_REGISTRATION_ROLES,
  UserRole,
} from '../../../shared/domain/user-role';
import {
  assertRequiredFields,
  assertStrongPassword,
} from '../domain/registration-rules';
import { PublicUser, toPublicUser, User } from '../domain/user.entity';
import type { PasswordHasher } from './ports/password-hasher.port';
import { PASSWORD_HASHER } from './ports/password-hasher.port';
import type { TokenIssuer } from './ports/token-issuer.port';
import { TOKEN_ISSUER } from './ports/token-issuer.port';
import type { UserRepository } from './ports/user.repository.port';
import { USER_REPOSITORY } from './ports/user.repository.port';
import {
  hashToken,
  ProfileInput,
  stripUndefined,
  UsersService,
} from './users.service';

export interface RegisterInput extends ProfileInput {
  email: string;
  password: string;
  role: UserRole;
}

export interface AuthSession {
  user: PublicUser;
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

const RESET_TTL_MS = 60 * 60 * 1000;

@Injectable()
export class AuthService {
  constructor(
    @Inject(USER_REPOSITORY) private readonly users: UserRepository,
    @Inject(PASSWORD_HASHER) private readonly hasher: PasswordHasher,
    @Inject(TOKEN_ISSUER) private readonly tokens: TokenIssuer,
    @Inject(EVENT_BUS) private readonly events: EventBus,
    private readonly accounts: UsersService,
  ) {}

  /** Public self sign-up. Privileged roles can only be created by admins. */
  async register(input: RegisterInput): Promise<AuthSession> {
    if (
      !(SELF_REGISTRATION_ROLES as readonly UserRole[]).includes(input.role)
    ) {
      throw new ForbiddenError(
        `Accounts with role ${input.role} cannot be self-registered`,
      );
    }
    return this.createAccount(input);
  }

  /**
   * Creates an account without the self-registration role restriction.
   * Used by trusted flows such as school registration and admin bootstrap.
   */
  async createAccount(
    input: RegisterInput & { schoolId?: string | null },
  ): Promise<AuthSession> {
    const email = input.email.toLowerCase().trim();
    assertStrongPassword(input.password);
    const { password, ...profile } = input;
    assertRequiredFields(input.role, profile);
    if (await this.users.findByEmail(email)) {
      throw new ConflictError('Email is already registered');
    }
    const user = await this.users.create({
      ...stripUndefined(profile),
      email,
      role: input.role,
      languageSpecializations: input.languageSpecializations ?? [],
      schoolId: input.schoolId ?? null,
      passwordHash: await this.hasher.hash(password),
      isActive: true,
    });
    return this.startSession(user);
  }

  async login(email: string, password: string): Promise<AuthSession> {
    const user = await this.users.findByEmail(email.toLowerCase().trim());
    // Compare even when the user is missing to keep timing uniform.
    const valid = await this.hasher.compare(
      password,
      user?.passwordHash ?? (await this.dummyHash()),
    );
    if (!user || !valid || !user.isActive) {
      throw new UnauthorizedError('Invalid email or password');
    }
    return this.startSession(user);
  }

  async refresh(refreshToken: string): Promise<AuthSession> {
    let sub: string;
    try {
      ({ sub } = await this.tokens.verifyRefresh(refreshToken));
    } catch {
      throw new UnauthorizedError('Invalid refresh token');
    }
    const user = await this.users.findById(sub);
    if (!user || !user.isActive || !user.refreshTokenHash) {
      throw new UnauthorizedError('Session expired, please log in again');
    }
    if (!sameHash(hashToken(refreshToken), user.refreshTokenHash)) {
      // A previously rotated token was replayed: revoke the session.
      await this.users.update(user.id, { refreshTokenHash: null });
      throw new UnauthorizedError('Session expired, please log in again');
    }
    return this.startSession(user);
  }

  async logout(userId: string): Promise<void> {
    await this.users.update(userId, { refreshTokenHash: null });
  }

  /** Self-service account deletion; requires the current password. */
  async deleteOwnAccount(userId: string, password: string): Promise<void> {
    const user = await this.users.findById(userId);
    if (!user || !(await this.hasher.compare(password, user.passwordHash))) {
      throw new UnauthorizedError('Password is incorrect');
    }
    await this.accounts.deleteAccount(userId);
  }

  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
  ): Promise<void> {
    const user = await this.users.findById(userId);
    if (
      !user ||
      !(await this.hasher.compare(currentPassword, user.passwordHash))
    ) {
      throw new UnauthorizedError('Current password is incorrect');
    }
    assertStrongPassword(newPassword);
    await this.users.update(userId, {
      passwordHash: await this.hasher.hash(newPassword),
      refreshTokenHash: null,
    });
  }

  /** Always succeeds from the caller's view so emails can't be enumerated. */
  async requestPasswordReset(email: string): Promise<void> {
    const user = await this.users.findByEmail(email.toLowerCase().trim());
    if (!user || !user.isActive) return;
    const token = randomBytes(32).toString('hex');
    await this.users.update(user.id, {
      passwordResetTokenHash: hashToken(token),
      passwordResetExpiresAt: new Date(Date.now() + RESET_TTL_MS),
    });
    await this.events.publish(
      new PasswordResetRequested(user.id, user.email, user.firstName, token),
    );
  }

  /** Completes a password reset or an invitation ("set your password"). */
  async resetPassword(
    token: string,
    newPassword: string,
  ): Promise<AuthSession> {
    const user = await this.users.findByPasswordResetTokenHash(
      hashToken(token),
    );
    if (
      !user ||
      !user.passwordResetExpiresAt ||
      user.passwordResetExpiresAt.getTime() < Date.now()
    ) {
      throw new ValidationError('This link is invalid or has expired');
    }
    assertStrongPassword(newPassword);
    const updated = await this.users.update(user.id, {
      passwordHash: await this.hasher.hash(newPassword),
      passwordResetTokenHash: null,
      passwordResetExpiresAt: null,
      refreshTokenHash: null,
    });
    return this.startSession(updated as User);
  }

  private dummyHashPromise?: Promise<string>;

  private dummyHash(): Promise<string> {
    this.dummyHashPromise ??= this.hasher.hash(randomBytes(16).toString('hex'));
    return this.dummyHashPromise;
  }

  private async startSession(user: User): Promise<AuthSession> {
    const accessToken = await this.tokens.signAccess({
      sub: user.id,
      email: user.email,
      role: user.role,
      schoolId: user.schoolId ?? null,
    });
    const refreshToken = await this.tokens.signRefresh(user.id);
    await this.users.update(user.id, {
      // SHA-256, not bcrypt: bcrypt ignores input past 72 bytes and all JWTs
      // for one user share their first 72 bytes.
      refreshTokenHash: hashToken(refreshToken),
      lastActiveAt: new Date(),
    });
    return {
      user: toPublicUser(user),
      accessToken,
      refreshToken,
      expiresIn: this.tokens.accessTtlSeconds,
    };
  }
}

function sameHash(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}
