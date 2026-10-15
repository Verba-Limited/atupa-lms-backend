import { Page, PageRequest } from '../../../../shared/domain/pagination';
import { UserRole } from '../../../../shared/domain/user-role';
import { User } from '../../domain/user.entity';

export const USER_REPOSITORY = Symbol('USER_REPOSITORY');

export interface UserFilter {
  role?: UserRole;
  schoolId?: string;
  isActive?: boolean;
  q?: string;
}

export interface UserRepository {
  create(input: Omit<User, 'id'>): Promise<User>;
  findById(id: string): Promise<User | null>;
  findByIds(ids: string[]): Promise<User[]>;
  findByEmail(email: string): Promise<User | null>;
  findByPasswordResetTokenHash(hash: string): Promise<User | null>;
  update(id: string, patch: Partial<User>): Promise<User | null>;
  list(filter: UserFilter, page: PageRequest): Promise<Page<User>>;
  countByRole(filter?: { schoolId?: string }): Promise<Record<string, number>>;
  countActiveSince(
    since: Date,
    filter?: { schoolId?: string },
  ): Promise<number>;
  findIds(
    filter: UserFilter & { preferredLanguageCode?: string },
    limit: number,
  ): Promise<string[]>;
}
