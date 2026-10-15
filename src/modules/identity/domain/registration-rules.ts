import { ValidationError } from '../../../shared/domain/errors';
import { UserRole } from '../../../shared/domain/user-role';
import { User } from './user.entity';

type ProfileField = keyof Pick<
  User,
  'firstName' | 'lastName' | 'phone' | 'dateOfBirth' | 'languageSpecializations'
>;

/** Required profile fields per role (PRD section 6). */
export const REQUIRED_FIELDS_BY_ROLE: Record<UserRole, ProfileField[]> = {
  [UserRole.LEARNER]: ['firstName', 'dateOfBirth'],
  [UserRole.PARENT]: ['firstName'],
  [UserRole.TEACHER]: [
    'firstName',
    'lastName',
    'phone',
    'languageSpecializations',
  ],
  [UserRole.SCHOOL_ADMIN]: ['firstName', 'lastName'],
  [UserRole.CONTENT_CREATOR]: ['firstName', 'lastName'],
  [UserRole.SUPER_ADMIN]: ['firstName'],
};

export function assertRequiredFields(
  role: UserRole,
  profile: Partial<User>,
): void {
  const missing = REQUIRED_FIELDS_BY_ROLE[role].filter((field) => {
    const value = profile[field];
    return Array.isArray(value) ? value.length === 0 : !value;
  });
  if (missing.length) {
    throw new ValidationError(
      `Missing required fields for ${role}: ${missing.join(', ')}`,
    );
  }
}

/** Passwords: 8-72 chars (bcrypt limit) with at least one letter and digit. */
export function assertStrongPassword(password: string): void {
  if (
    password.length < 8 ||
    password.length > 72 ||
    !/[A-Za-z]/.test(password) ||
    !/\d/.test(password)
  ) {
    throw new ValidationError(
      'Password must be 8-72 characters and include a letter and a number',
    );
  }
}
