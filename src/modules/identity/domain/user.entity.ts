import { UserRole } from '../../../shared/domain/user-role';

/**
 * Teachers start unverified. ATUPA checks their documents and approves
 * (verified) or rejects them. Other roles do not need verification.
 */
export enum VerificationStatus {
  NOT_REQUIRED = 'not_required',
  UNVERIFIED = 'unverified',
  PENDING = 'pending',
  VERIFIED = 'verified',
  REJECTED = 'rejected',
}

export interface VerificationDocument {
  mediaId: string;
  url: string;
  label: string;
}

export interface User {
  id: string;
  email: string;
  passwordHash: string;
  role: UserRole;
  firstName?: string;
  lastName?: string;
  phone?: string | null;
  dateOfBirth?: Date | null;
  preferredLanguageCode?: string;
  profileImageUrl?: string | null;
  teachingExperienceYears?: number;
  languageSpecializations: string[];
  schoolId?: string | null;
  isActive: boolean;
  refreshTokenHash?: string | null;
  passwordResetTokenHash?: string | null;
  passwordResetExpiresAt?: Date | null;
  lastActiveAt?: Date;
  lastLoginAt?: Date | null;
  verificationStatus?: VerificationStatus;
  verificationDocuments?: VerificationDocument[];
  /** Teacher's note to reviewers, or the reviewer's reason on rejection. */
  verificationNote?: string | null;
  verificationSubmittedAt?: Date | null;
  verifiedAt?: Date | null;
  verifiedByUserId?: string | null;
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
  return { ...rest, verificationStatus: verificationStatusOf(user) };
}

export function initialVerificationStatus(role: UserRole): VerificationStatus {
  return role === UserRole.TEACHER
    ? VerificationStatus.UNVERIFIED
    : VerificationStatus.NOT_REQUIRED;
}

/** Older accounts have no stored status; derive it from the role. */
export function verificationStatusOf(
  user: Pick<User, 'role' | 'verificationStatus'>,
): VerificationStatus {
  return user.verificationStatus ?? initialVerificationStatus(user.role);
}

export function isVerifiedTeacher(
  user: Pick<User, 'role' | 'verificationStatus'>,
): boolean {
  return (
    user.role === UserRole.TEACHER &&
    verificationStatusOf(user) === VerificationStatus.VERIFIED
  );
}
