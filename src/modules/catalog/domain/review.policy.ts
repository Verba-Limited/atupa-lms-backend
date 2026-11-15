import { Actor } from '../../../shared/application/actor';
import { ContentStatus } from '../../../shared/domain/enums';
import { UserRole } from '../../../shared/domain/user-role';
import { Course, CourseOwnerType, CourseVisibility } from './course.entity';

/**
 * Content goes live without review only when a super admin publishes it, or
 * when a teacher publishes into their own (Private/School) course. ATUPA
 * content and Public teacher courses need a super admin's approval (M-19).
 */
export function requiresReview(
  actor: Actor,
  course: Pick<Course, 'ownerType' | 'visibility'>,
): boolean {
  if (actor.role === UserRole.SUPER_ADMIN) return false;
  return (
    course.ownerType === CourseOwnerType.ATUPA ||
    course.visibility === CourseVisibility.PUBLIC
  );
}

/** Learners can browse and search a course only when it is Public and live. */
export function isDiscoverable(
  course: Pick<Course, 'status' | 'visibility'>,
): boolean {
  return (
    course.status === ContentStatus.PUBLISHED &&
    course.visibility === CourseVisibility.PUBLIC
  );
}
