import { Injectable } from '@nestjs/common';
import type { Actor } from '../../../shared/application/actor';
import { PaymentRequiredError } from '../../../shared/domain/errors';
import { CONTENT_AUTHOR_ROLES } from '../../../shared/domain/user-role';
import type { Course } from '../../catalog';
import { SubscriptionsService } from '../../subscriptions';

/** Premium content requires an active personal or school subscription. */
@Injectable()
export class LearningAccessService {
  constructor(private readonly subscriptions: SubscriptionsService) {}

  async assertCanLearn(actor: Actor, course: Course): Promise<void> {
    if (!course.isPremium || CONTENT_AUTHOR_ROLES.includes(actor.role)) return;
    if (
      !(await this.subscriptions.hasPremiumAccess(actor.userId, actor.schoolId))
    ) {
      throw new PaymentRequiredError(
        'This is a premium course. Upgrade to Individual Premium or join a subscribed school.',
      );
    }
  }
}
