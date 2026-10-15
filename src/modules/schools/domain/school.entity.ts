import { Actor } from '../../../shared/application/actor';
import { ForbiddenError } from '../../../shared/domain/errors';
import { UserRole } from '../../../shared/domain/user-role';

export interface SchoolSettings {
  /** Leaderboards are optional (PRD section 15). */
  leaderboardsEnabled: boolean;
  /** For children: show full names publicly or initials only. */
  showLearnerNamesOnLeaderboards: boolean;
}

export interface School {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  address?: string;
  region?: string;
  declaredStudentCount?: number;
  adminUserId?: string;
  /** Code teachers/learners use to join this school. */
  joinCode: string;
  settings: SchoolSettings;
  isActive: boolean;
  createdAt?: Date;
}

export const DEFAULT_SCHOOL_SETTINGS: SchoolSettings = {
  leaderboardsEnabled: true,
  showLearnerNamesOnLeaderboards: false,
};

export function canAdministerSchool(actor: Actor, schoolId: string): boolean {
  return (
    actor.role === UserRole.SUPER_ADMIN ||
    (actor.role === UserRole.SCHOOL_ADMIN && actor.schoolId === schoolId)
  );
}

export function assertCanAdministerSchool(
  actor: Actor,
  schoolId: string,
): void {
  if (!canAdministerSchool(actor, schoolId)) {
    throw new ForbiddenError('You can only manage your own school');
  }
}
