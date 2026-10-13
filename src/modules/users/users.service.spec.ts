import { BadRequestException } from '@nestjs/common';
import { UserRole } from '../../common/enums/user-role.enum';
import { UsersService } from './users.service';
import { IUserRepository } from './interfaces/user-repository.interface';

describe('UsersService', () => {
  const repository: jest.Mocked<IUserRepository> = {
    create: jest.fn(),
    findByEmail: jest.fn(),
    findById: jest.fn(),
    updateRefreshTokenHash: jest.fn(),
    linkChild: jest.fn(),
  };

  const service = new UsersService(repository);

  it('validates role-specific required fields', () => {
    expect(() =>
      service.validateRoleFields(UserRole.LEARNER, {}),
    ).toThrow(BadRequestException);
  });

  it('creates user when role fields are valid', async () => {
    repository.create.mockResolvedValue({} as never);
    await service.createUser({
      email: 'learner@test.com',
      passwordHash: 'hash',
      role: UserRole.LEARNER,
      firstName: 'Ada',
    });
    expect(repository.create).toHaveBeenCalled();
  });
});
