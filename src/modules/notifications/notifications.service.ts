import { Inject, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { NOTIFICATION_PORT } from '../../common/tokens/repository.tokens';
import type { NotificationPort } from './interfaces/notification.port';
import {
  InAppNotification,
  InAppNotificationDocument,
} from './schemas/in-app-notification.schema';

@Injectable()
export class NotificationsService {
  constructor(
    @InjectModel(InAppNotification.name)
    private readonly notificationModel: Model<InAppNotification>,
    @Inject(NOTIFICATION_PORT)
    private readonly notificationPort: NotificationPort,
  ) {}

  async notify(input: {
    userId: string;
    email?: string;
    title: string;
    body: string;
    sendEmail?: boolean;
  }) {
    await this.notificationModel.create({
      userId: input.userId,
      title: input.title,
      body: input.body,
      read: false,
    });
    await this.notificationPort.send({
      userId: input.userId,
      email: input.email,
      title: input.title,
      body: input.body,
      channel: 'in_app',
    });
    if (input.sendEmail && input.email) {
      await this.notificationPort.send({
        userId: input.userId,
        email: input.email,
        title: input.title,
        body: input.body,
        channel: 'email',
      });
    }
  }

  list(userId: string): Promise<InAppNotificationDocument[]> {
    return this.notificationModel
      .find({ userId })
      .sort({ createdAt: -1 })
      .limit(50)
      .exec();
  }
}
