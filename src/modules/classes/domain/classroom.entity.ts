import { Actor } from '../../../shared/application/actor';
import { ForbiddenError } from '../../../shared/domain/errors';
import { UserRole } from '../../../shared/domain/user-role';

export interface Classroom {
  id: string;
  /** Null for an independent teacher's class. */
  schoolId: string | null;
  name: string;
  description?: string;
  languageCode?: string;
  teacherUserId: string;
  studentUserIds: string[];
  assignedCourseIds: string[];
  /** Learners can join with this code (consent for independent classes). */
  joinCode: string;
  isArchived: boolean;
  createdAt?: Date;
}

export function canManageClass(actor: Actor, classroom: Classroom): boolean {
  switch (actor.role) {
    case UserRole.SUPER_ADMIN:
      return true;
    case UserRole.SCHOOL_ADMIN:
      return !!classroom.schoolId && classroom.schoolId === actor.schoolId;
    case UserRole.TEACHER:
      return classroom.teacherUserId === actor.userId;
    default:
      return false;
  }
}

export function canViewClass(actor: Actor, classroom: Classroom): boolean {
  return (
    canManageClass(actor, classroom) ||
    (actor.role === UserRole.LEARNER &&
      classroom.studentUserIds.includes(actor.userId))
  );
}

export function assertCanManageClass(actor: Actor, classroom: Classroom): void {
  if (!canManageClass(actor, classroom)) {
    throw new ForbiddenError('You do not manage this class');
  }
}
