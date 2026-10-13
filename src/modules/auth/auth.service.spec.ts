import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';
import { UserRole } from '../../common/enums/user-role.enum';

jest.mock('bcrypt');

describe('AuthService', () => {
  const usersService = {
    findByEmail: jest.fn(),
    createUser: jest.fn(),
    updateRefreshToken: jest.fn(),
    getByIdOrThrow: jest.fn(),
  } as unknown as UsersService;

  const jwtService = {
    signAsync: jest.fn().mockResolvedValue('token'),
    verifyAsync: jest.fn(),
  } as unknown as JwtService;

  const configService = {
    get: jest.fn((key: string) => {
      if (key.includes('SECRET')) return 'secret';
      return '1d';
    }),
    getOrThrow: jest.fn((key: string) => {
      if (key.includes('SECRET')) return 'secret';
      return '1d';
    }),
  } as unknown as ConfigService;

  const service = new AuthService(usersService, jwtService, configService);

  beforeEach(() => jest.clearAllMocks());

  it('rejects duplicate registration', async () => {
    usersService.findByEmail = jest.fn().mockResolvedValue({ id: '1' });
    await expect(
      service.register({
        email: 'a@test.com',
        password: 'password1',
        role: UserRole.LEARNER,
        firstName: 'A',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('rejects invalid login', async () => {
    usersService.findByEmail = jest.fn().mockResolvedValue(null);
    await expect(
      service.login({ email: 'a@test.com', password: 'password1' }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('logs in with valid credentials', async () => {
    usersService.findByEmail = jest.fn().mockResolvedValue({
      _id: 'user1',
      email: 'a@test.com',
      passwordHash: 'hash',
      isActive: true,
      role: UserRole.LEARNER,
    });
    (bcrypt.compare as jest.Mock).mockResolvedValue(true);
    usersService.updateRefreshToken = jest.fn().mockResolvedValue(undefined);
    (bcrypt.hash as jest.Mock).mockResolvedValue('refresh-hash');

    const result = await service.login({
      email: 'a@test.com',
      password: 'password1',
    });
    expect(result.accessToken).toBe('token');
  });
});
