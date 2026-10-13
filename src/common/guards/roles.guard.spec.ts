import { ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from '../enums/user-role.enum';
import { RolesGuard } from './roles.guard';

describe('RolesGuard', () => {
  const reflector = {
    getAllAndOverride: jest.fn(),
  } as unknown as Reflector;
  const guard = new RolesGuard(reflector);

  it('allows access when role matches', () => {
    reflector.getAllAndOverride = jest.fn().mockReturnValue([UserRole.TEACHER]);
    const context = {
      getHandler: () => ({}),
      getClass: () => ({}),
      switchToHttp: () => ({
        getRequest: () => ({ user: { role: UserRole.TEACHER } }),
      }),
    } as never;
    expect(guard.canActivate(context)).toBe(true);
  });

  it('denies access for wrong role', () => {
    reflector.getAllAndOverride = jest.fn().mockReturnValue([UserRole.SUPER_ADMIN]);
    const context = {
      getHandler: () => ({}),
      getClass: () => ({}),
      switchToHttp: () => ({
        getRequest: () => ({ user: { role: UserRole.LEARNER } }),
      }),
    } as never;
    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });
});
