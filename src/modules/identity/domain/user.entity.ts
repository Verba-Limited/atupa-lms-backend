import { UserRole } from '../../../shared/domain/user-role';

export interface User {
  id: string;
  email: string;
  passwordHash: string;
  role: UserRole;
  firstName?: string;
  lastName?: string;
  phone?: string;
  dateOfBirth?: Date;
  preferredLanguageCode?: string;
  profileImageUrl?: string;
  teachingExperienceYears?: number;
  languageSpecializations: string[];
  schoolId?: string | null;
  isActive: boolean;
  refreshTokenHash?: string | null;
  passwordResetTokenHash?: string | null;
  passwordResetExpiresAt?: Date | null;
  lastActiveAt?: Date;
  createdAt?: Date;
  updatedAt?: Date;
}

/** User data that is safe to expose outside the identity module. */
export type PublicUser = Omit<
  User,
  | 'passwordHash'
  | 'refreshTokenHash'
  | 'passwordResetTokenHash'
  | 'passwordResetExpiresAt'
>;

export function toPublicUser(user: User): PublicUser {
  const {
    passwordHash,
    refreshTokenHash,
    passwordResetTokenHash,
    passwordResetExpiresAt,
    ...rest
  } = user;
  void passwordHash;
  void refreshTokenHash;
  void passwordResetTokenHash;
  void passwordResetExpiresAt;
  return rest;
}
