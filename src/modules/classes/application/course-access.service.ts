import { Injectable } from '@nestjs/common';
import type { Actor } from '../../../shared/application/actor';
import { ForbiddenError } from '../../../shared/domain/errors';
import {
  PLATFORM_CONTENT_ROLES,
  UserRole,
} from '../../../shared/domain/user-role';
import { type Course, CourseVisibility } from '../../catalog';
import { ClassesService } from './classes.service';

/**
 * Who may take a course (M-25):
 * - Public: anyone
 * - School: learners of the course's school
 * - Private: learners in a class the course is assigned to
 * Learners already enrolled keep access if a course is made Private later.
 * Authors and ATUPA staff can always open it.
 */
@Injectable()
export class CourseAccessService {
  constructor(private readonly classes: ClassesService) {}

  async canLearn(
    actor: Actor,
    course: Course,
    enrolled: boolean,
  ): Promise<boolean> {
    if (course.visibility === CourseVisibility.PUBLIC || enrolled) return true;
    if (PLATFORM_CONTENT_ROLES.includes(actor.role)) return true;
    if (course.createdByUserId === actor.userId) return true;
    const sameSchool = !!course.schoolId && course.schoolId === actor.schoolId;
    if (actor.role === UserRole.SCHOOL_ADMIN) return sameSchool;
    if (course.visibility === CourseVisibility.SCHOOL && sameSchool) {
      return true;
    }
    if (actor.role === UserRole.LEARNER) {
      return this.classes.isCourseAssignedToLearner(actor.userId, course.id);
    }
    return false;
  }

  async assertCanLearn(
    actor: Actor,
    course: Course,
    enrolled: boolean,
  ): Promise<void> {
    if (!(await this.canLearn(actor, course, enrolled))) {
      throw new ForbiddenError(
        'This course is private. Ask your teacher to add you to their class.',
      );
    }
  }
}
