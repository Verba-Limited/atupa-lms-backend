import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { parseDuration } from '../config/app-config';
import { validateEnv } from '../config/env.validation';
import { containsPattern, escapeRegex, shortName } from './domain/text';
import { UserRole } from './domain/user-role';
import { RolesGuard } from './presentation/guards/roles.guard';

describe('shared kernel', () => {
  it('escapes regex metacharacters from user input', () => {
    expect(() => new RegExp(escapeRegex('((([*'))).not.toThrow();
    expect(containsPattern('a.b').test('axb')).toBe(false);
    expect(containsPattern('a.b').test('A.B')).toBe(true);
  });

  it('shows child-safe short names', () => {
    expect(shortName({ firstName: 'Ada', lastName: 'Obi' })).toBe('Ada O.');
  });

  it('parses durations', () => {
    expect(parseDuration('15m')).toBe(900);
    expect(parseDuration('7d')).toBe(604800);
    expect(parseDuration('60')).toBe(60);
    expect(() => parseDuration('soon')).toThrow();
  });

  it('refuses weak or missing secrets in production', () => {
    expect(() =>
      validateEnv({
        NODE_ENV: 'production',
        JWT_SECRET: 'change_me_in_production',
        JWT_REFRESH_SECRET: 'x',
        MONGODB_URI: 'm',
      }),
    ).toThrow();
    expect(() =>
      validateEnv({ JWT_SECRET: 'same', JWT_REFRESH_SECRET: 'same' }),
    ).toThrow('must differ');
    expect(() =>
      validateEnv({
        NODE_ENV: 'production',
        JWT_SECRET: 'a'.repeat(40),
        JWT_REFRESH_SECRET: 'b'.repeat(40),
        MONGODB_URI: 'm',
      }),
    ).not.toThrow();
  });
});

describe('RolesGuard', () => {
  const contextFor = (role?: UserRole) =>
    ({
      getHandler: () => undefined,
      getClass: () => undefined,
      switchToHttp: () => ({
        getRequest: () => ({ user: role ? { role } : undefined }),
      }),
    }) as unknown as ExecutionContext;

  it('allows when no roles are required', () => {
    const reflector = {
      getAllAndOverride: () => undefined,
    } as unknown as Reflector;
    expect(new RolesGuard(reflector).canActivate(contextFor())).toBe(true);
  });

  it('enforces required roles', () => {
    const reflector = {
      getAllAndOverride: () => [UserRole.TEACHER],
    } as unknown as Reflector;
    const guard = new RolesGuard(reflector);
    expect(guard.canActivate(contextFor(UserRole.TEACHER))).toBe(true);
    expect(() => guard.canActivate(contextFor(UserRole.LEARNER))).toThrow(
      ForbiddenException,
    );
  });
});
