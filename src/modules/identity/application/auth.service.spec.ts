import {
  ConflictError,
  ForbiddenError,
  UnauthorizedError,
  ValidationError,
} from '../../../shared/domain/errors';
import { UserRole } from '../../../shared/domain/user-role';
import { User } from '../domain/user.entity';
import { AuthService } from './auth.service';
import { UserRepository } from './ports/user.repository.port';

class InMemoryUsers implements Partial<UserRepository> {
  users = new Map<string, User>();
  private seq = 0;
  create(input: Omit<User, 'id'>) {
    const user = { ...input, id: String(++this.seq) };
    this.users.set(user.id, user);
    return Promise.resolve(user);
  }
  findById(id: string) {
    return Promise.resolve(this.users.get(id) ?? null);
  }
  findByEmail(email: string) {
    return Promise.resolve(
      [...this.users.values()].find((u) => u.email === email) ?? null,
    );
  }
  findByPasswordResetTokenHash(hash: string) {
    return Promise.resolve(
      [...this.users.values()].find((u) => u.passwordResetTokenHash === hash) ??
        null,
    );
  }
  update(id: string, patch: Partial<User>) {
    const user = { ...this.users.get(id)!, ...patch };
    this.users.set(id, user);
    return Promise.resolve(user);
  }
}

function setup() {
  const users = new InMemoryUsers();
  const hasher = {
    hash: (p: string) => Promise.resolve(`h:${p}`),
    compare: (p: string, h: string) => Promise.resolve(h === `h:${p}`),
  };
  let n = 0;
  const tokens = {
    accessTtlSeconds: 900,
    signAccess: () => Promise.resolve(`access-${++n}`),
    signRefresh: (sub: string) => Promise.resolve(`refresh.${sub}.${++n}`),
    verifyRefresh: (t: string) => Promise.resolve({ sub: t.split('.')[1] }),
  };
  const events = { publish: jest.fn().mockResolvedValue(undefined) };
  const accounts = { deleteAccount: jest.fn().mockResolvedValue(undefined) };
  const service = new AuthService(
    users as unknown as UserRepository,
    hasher,
    tokens,
    events,
    accounts as never,
  );
  return { service, users, events, accounts };
}

const learner = {
  email: 'ada@test.com',
  password: 'Passw0rd!',
  role: UserRole.LEARNER,
  firstName: 'Ada',
  dateOfBirth: new Date('2014-01-01'),
};

describe('AuthService', () => {
  it('refuses privileged self-registration', async () => {
    const { service } = setup();
    await expect(
      service.register({ ...learner, role: UserRole.SUPER_ADMIN }),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it('enforces required fields and unique email', async () => {
    const { service } = setup();
    await expect(
      service.register({ ...learner, dateOfBirth: undefined }),
    ).rejects.toBeInstanceOf(ValidationError);
    await service.register(learner);
    await expect(service.register(learner)).rejects.toBeInstanceOf(
      ConflictError,
    );
  });

  it('does not reveal whether an email exists on login', async () => {
    const { service } = setup();
    await service.register(learner);
    await expect(service.login('nobody@test.com', 'x')).rejects.toThrow(
      'Invalid email or password',
    );
    await expect(service.login(learner.email, 'wrong')).rejects.toThrow(
      'Invalid email or password',
    );
  });

  it('rotates refresh tokens and revokes on reuse', async () => {
    const { service } = setup();
    const session = await service.register(learner);
    const next = await service.refresh(session.refreshToken);
    await expect(service.refresh(session.refreshToken)).rejects.toBeInstanceOf(
      UnauthorizedError,
    );
    await expect(service.refresh(next.refreshToken)).rejects.toBeInstanceOf(
      UnauthorizedError,
    );
  });

  it('resets passwords with a single-use token', async () => {
    const { service, events } = setup();
    await service.register(learner);
    await service.requestPasswordReset(learner.email);
    const token = events.publish.mock.calls[0][0].resetToken as string;
    await service.resetPassword(token, 'NewPassw0rd');
    await expect(
      service.login(learner.email, 'NewPassw0rd'),
    ).resolves.toBeDefined();
    await expect(
      service.resetPassword(token, 'Another1pass'),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it('stays silent for unknown emails on reset', async () => {
    const { service, events } = setup();
    await service.requestPasswordReset('ghost@test.com');
    expect(events.publish).not.toHaveBeenCalled();
  });

  it('deletes my account only with the right password', async () => {
    const { service, accounts } = setup();
    const session = await service.register(learner);
    await expect(
      service.deleteOwnAccount(session.user.id, 'wrong'),
    ).rejects.toBeInstanceOf(UnauthorizedError);
    await service.deleteOwnAccount(session.user.id, learner.password);
    expect(accounts.deleteAccount).toHaveBeenCalledWith(session.user.id);
  });
});
