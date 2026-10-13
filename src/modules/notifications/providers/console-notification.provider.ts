import { Injectable, Logger } from '@nestjs/common';
import {
  NotificationMessage,
  NotificationPort,
} from '../interfaces/notification.port';

@Injectable()
export class ConsoleNotificationProvider implements NotificationPort {
  private readonly logger = new Logger(ConsoleNotificationProvider.name);

  async send(message: NotificationMessage): Promise<void> {
    this.logger.log(
      `[${message.channel}] to ${message.userId}${message.email ? ` (${message.email})` : ''}: ${message.title}`,
    );
  }
}
