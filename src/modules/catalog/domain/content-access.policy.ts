import { Actor } from '../../../shared/application/actor';
import { ForbiddenError } from '../../../shared/domain/errors';
import {
  CONTENT_AUTHOR_ROLES,
  PLATFORM_CONTENT_ROLES,
  UserRole,
} from '../../../shared/domain/user-role';
import { Course } from './course.entity';

/**
 * Who may edit a course:
 * - content creators and super admins: any course
 * - school admins: courses belonging to their school
 * - teachers: courses they created
 */
export function canManageCourse(actor: Actor, course: Course): boolean {
  if (PLATFORM_CONTENT_ROLES.includes(actor.role)) return true;
  if (actor.role === UserRole.SCHOOL_ADMIN) {
    return !!course.schoolId && course.schoolId === actor.schoolId;
  }
  if (actor.role === UserRole.TEACHER) {
    return course.createdByUserId === actor.userId;
  }
  return false;
}

export function assertCanManageCourse(actor: Actor, course: Course): void {
  if (!canManageCourse(actor, course)) {
    throw new ForbiddenError('You can only manage courses you own');
  }
}

export function assertContentAuthor(actor: Actor): void {
  if (!CONTENT_AUTHOR_ROLES.includes(actor.role)) {
    throw new ForbiddenError('You cannot manage learning content');
  }
}
