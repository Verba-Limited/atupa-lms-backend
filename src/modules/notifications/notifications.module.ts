import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AppConfig } from '../../config/app-config';
import { CatalogModule } from '../catalog';
import { IdentityModule } from '../identity';
import { ParentsModule } from '../parents';
import { ProgressModule } from '../progress';
import { NotificationsService } from './application/notifications.service';
import {
  EMAIL_SENDER,
  NOTIFICATION_REPOSITORY,
} from './application/ports/notification.ports';
import { ConsoleEmailSender } from './infrastructure/email/console.email-sender';
import { ResendEmailSender } from './infrastructure/email/resend.email-sender';
import { NotificationMongoRepository } from './infrastructure/persistence/notification.mongo-repository';
import {
  NotificationRecord,
  NotificationSchema,
} from './infrastructure/persistence/notification.schema';
import { LearningRemindersJob } from './infrastructure/scheduling/learning-reminders.job';
import { NotificationsListeners } from './presentation/events/notifications.listeners';
import { NotificationsController } from './presentation/http/notifications.controller';

@Module({
  imports: [
    IdentityModule,
    ParentsModule,
    ProgressModule,
    CatalogModule,
    MongooseModule.forFeature([
      { name: NotificationRecord.name, schema: NotificationSchema },
    ]),
  ],
  controllers: [NotificationsController],
  providers: [
    NotificationsService,
    NotificationsListeners,
    LearningRemindersJob,
    { provide: NOTIFICATION_REPOSITORY, useClass: NotificationMongoRepository },
    {
      provide: EMAIL_SENDER,
      inject: [AppConfig],
      useFactory: (config: AppConfig) => {
        const { apiKey, from } = config.resend;
        return apiKey
          ? new ResendEmailSender(apiKey, from)
          : new ConsoleEmailSender(!config.isProduction);
      },
    },
  ],
  exports: [NotificationsService],
})
export class NotificationsModule {}
