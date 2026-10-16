import { Page, PageRequest } from '../../../../shared/domain/pagination';
import {
  InAppNotification,
  NewNotification,
} from '../../domain/notification.entity';

export const NOTIFICATION_REPOSITORY = Symbol('NOTIFICATION_REPOSITORY');
export const EMAIL_SENDER = Symbol('EMAIL_SENDER');

export interface NotificationRepository {
  createMany(items: NewNotification[]): Promise<void>;
  list(
    userId: string,
    unreadOnly: boolean,
    page: PageRequest,
  ): Promise<Page<InAppNotification>>;
  countUnread(userId: string): Promise<number>;
  markRead(userId: string, id: string): Promise<boolean>;
  markAllRead(userId: string): Promise<number>;
  delete(userId: string, id: string): Promise<boolean>;
}

export interface EmailMessage {
  to: string;
  subject: string;
  html: string;
  text: string;
}

/** Outbound port for transactional email (Resend in production). */
export interface EmailSender {
  send(message: EmailMessage): Promise<void>;
}
