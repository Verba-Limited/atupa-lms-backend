import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Inject } from '@nestjs/common';
import { USER_REPOSITORY } from '../../common/tokens/repository.tokens';
import { UserRole } from '../../common/enums/user-role.enum';
import type { CreateUserInput } from './interfaces/user-repository.interface';
import { UserDocument } from './schemas/user.schema';
import { UsersRepository } from './users.repository';

const ROLE_REQUIRED_FIELDS: Record<UserRole, string[]> = {
  [UserRole.LEARNER]: ['firstName'],
  [UserRole.PARENT]: ['firstName', 'phone'],
  [UserRole.TEACHER]: ['firstName', 'lastName'],
  [UserRole.SCHOOL_ADMIN]: ['firstName', 'lastName', 'schoolId'],
  [UserRole.CONTENT_CREATOR]: ['firstName', 'lastName'],
  [UserRole.SUPER_ADMIN]: ['firstName', 'lastName'],
};

@Injectable()
export class UsersService {
  constructor(
    @Inject(USER_REPOSITORY)
    private readonly usersRepository: UsersRepository,
  ) {}

  validateRoleFields(role: UserRole, payload: Record<string, unknown>): void {
    const missing = ROLE_REQUIRED_FIELDS[role].filter(
      (field) => !payload[field],
    );
    if (missing.length) {
      throw new BadRequestException(
        `Missing required fields for ${role}: ${missing.join(', ')}`,
      );
    }
  }

  createUser(input: CreateUserInput): Promise<UserDocument> {
    this.validateRoleFields(input.role, input as unknown as Record<string, unknown>);
    return this.usersRepository.create(input);
  }

  findByEmail(email: string): Promise<UserDocument | null> {
    return this.usersRepository.findByEmail(email);
  }

  async getByIdOrThrow(id: string): Promise<UserDocument> {
    const user = await this.usersRepository.findById(id);
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return user;
  }

  updateRefreshToken(userId: string, refreshTokenHash?: string): Promise<void> {
    return this.usersRepository.updateRefreshTokenHash(userId, refreshTokenHash);
  }

  linkChild(parentId: string, childId: string): Promise<UserDocument> {
    return this.usersRepository
      .linkChild(parentId, childId)
      .then((parent) => {
        if (!parent) {
          throw new NotFoundException('Parent account not found');
        }
        return parent;
      });
  }
}
