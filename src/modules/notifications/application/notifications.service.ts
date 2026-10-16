import { Inject, Injectable, Logger } from '@nestjs/common';
import type { Actor } from '../../../shared/application/actor';
import { NotFoundError } from '../../../shared/domain/errors';
import { PageRequest } from '../../../shared/domain/pagination';
import { UsersService } from '../../identity';
import { ParentsService } from '../../parents';
import { NewNotification } from '../domain/notification.entity';
import type {
  EmailMessage,
  EmailSender,
  NotificationRepository,
} from './ports/notification.ports';
import {
  EMAIL_SENDER,
  NOTIFICATION_REPOSITORY,
} from './ports/notification.ports';

type Content = Omit<NewNotification, 'userId'>;

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    @Inject(NOTIFICATION_REPOSITORY)
    private readonly notifications: NotificationRepository,
    @Inject(EMAIL_SENDER) private readonly email: EmailSender,
    private readonly users: UsersService,
    private readonly parents: ParentsService,
  ) {}

  async notify(userIds: string[], content: Content): Promise<void> {
    const unique = [...new Set(userIds)];
    if (!unique.length) return;
    await this.notifications.createMany(
      unique.map((userId) => ({ userId, ...content })),
    );
  }

  /** Notifies every parent linked to a learner. */
  async notifyParentsOf(
    learnerId: string,
    build: (childName: string) => Content,
  ): Promise<string[]> {
    const parentIds = await this.parents.listParentIds(learnerId);
    if (!parentIds.length) return [];
    const child = await this.users.findById(learnerId);
    await this.notify(parentIds, build(child?.firstName ?? 'Your child'));
    return parentIds;
  }

  /** Best-effort email: failures are logged, never thrown to the caller. */
  async sendEmail(message: EmailMessage): Promise<void> {
    try {
      await this.email.send(message);
    } catch (error) {
      this.logger.error(
        `Email to ${message.to} failed: ${(error as Error).message}`,
      );
    }
  }

  async emailUsers(
    userIds: string[],
    build: (user: { email: string; firstName?: string }) => EmailMessage,
  ) {
    const users = await this.users.findByIds(userIds);
    await Promise.all(
      users.filter((u) => u.isActive).map((u) => this.sendEmail(build(u))),
    );
  }

  list(actor: Actor, unreadOnly: boolean, page: PageRequest) {
    return this.notifications.list(actor.userId, unreadOnly, page);
  }

  countUnread(actor: Actor) {
    return this.notifications.countUnread(actor.userId);
  }

  async markRead(actor: Actor, id: string): Promise<void> {
    if (!(await this.notifications.markRead(actor.userId, id))) {
      throw new NotFoundError('Notification not found');
    }
  }

  async remove(actor: Actor, id: string): Promise<void> {
    if (!(await this.notifications.delete(actor.userId, id))) {
      throw new NotFoundError('Notification not found');
    }
  }

  markAllRead(actor: Actor) {
    return this.notifications.markAllRead(actor.userId);
  }
}
