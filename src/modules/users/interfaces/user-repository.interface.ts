import { UserRole } from '../../../common/enums/user-role.enum';
import { UserDocument } from '../schemas/user.schema';

export interface CreateUserInput {
  email: string;
  passwordHash: string;
  role: UserRole;
  firstName?: string;
  lastName?: string;
  phone?: string;
  schoolId?: string;
}

export interface IUserRepository {
  create(input: CreateUserInput): Promise<UserDocument>;
  findByEmail(email: string): Promise<UserDocument | null>;
  findById(id: string): Promise<UserDocument | null>;
  updateRefreshTokenHash(
    userId: string,
    refreshTokenHash?: string,
  ): Promise<void>;
  linkChild(parentId: string, childId: string): Promise<UserDocument | null>;
}
