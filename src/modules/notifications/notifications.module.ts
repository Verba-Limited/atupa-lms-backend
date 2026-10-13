import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { NOTIFICATION_PORT } from '../../common/tokens/repository.tokens';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { ConsoleNotificationProvider } from './providers/console-notification.provider';
import {
  InAppNotification,
  InAppNotificationSchema,
} from './schemas/in-app-notification.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: InAppNotification.name, schema: InAppNotificationSchema },
    ]),
  ],
  controllers: [NotificationsController],
  providers: [
    NotificationsService,
    { provide: NOTIFICATION_PORT, useClass: ConsoleNotificationProvider },
  ],
  exports: [NotificationsService],
})
export class NotificationsModule {}
