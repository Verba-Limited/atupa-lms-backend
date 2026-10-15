import { Injectable } from '@nestjs/common';
import type { Actor } from '../../../shared/application/actor';
import { ForbiddenError, NotFoundError } from '../../../shared/domain/errors';
import { UserRole } from '../../../shared/domain/user-role';
import { ClassesService } from '../../classes';
import { PublicUser, UsersService } from '../../identity';
import { ParentsService } from '../../parents';

/**
 * Who may see a learner's data:
 * the learner, linked parents, teachers of a class they are in,
 * admins of their school, and super admins.
 */
@Injectable()
export class LearnerAccessService {
  constructor(
    private readonly users: UsersService,
    private readonly parents: ParentsService,
    private readonly classes: ClassesService,
  ) {}

  async assertCanView(actor: Actor, learnerId: string): Promise<PublicUser> {
    const learner = await this.users.findById(learnerId);
    if (!learner || learner.role !== UserRole.LEARNER) {
      throw new NotFoundError('Learner not found');
    }
    if (await this.canView(actor, learner)) return learner;
    throw new ForbiddenError("You cannot view this learner's data");
  }

  private async canView(actor: Actor, learner: PublicUser): Promise<boolean> {
    switch (actor.role) {
      case UserRole.SUPER_ADMIN:
        return true;
      case UserRole.LEARNER:
        return actor.userId === learner.id;
      case UserRole.PARENT:
        return this.parents.isParentOf(actor.userId, learner.id);
      case UserRole.TEACHER:
        return this.classes.isTeacherOfStudent(actor.userId, learner.id);
      case UserRole.SCHOOL_ADMIN:
        return !!actor.schoolId && learner.schoolId === actor.schoolId;
      default:
        return false;
    }
  }
}
