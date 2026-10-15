import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { AppConfig } from '../../../../config/app-config';
import { ProgressQueryService } from '../../../progress';
import { NotificationsService } from '../../application/notifications.service';
import { NotificationType } from '../../domain/notification.entity';

/**
 * Daily at 17:00 Lagos time: remind learners who learned yesterday but not
 * yet today that their streak is about to end.
 */
@Injectable()
export class LearningRemindersJob {
  private readonly logger = new Logger(LearningRemindersJob.name);

  constructor(
    private readonly progress: ProgressQueryService,
    private readonly notifications: NotificationsService,
    private readonly config: AppConfig,
  ) {}

  @Cron('0 17 * * *', { timeZone: 'Africa/Lagos', name: 'learning-reminders' })
  async run(): Promise<void> {
    if (!this.config.remindersEnabled) return;
    const learnerIds = await this.progress.learnersWithStreakAtRisk();
    await this.notifications.notify(learnerIds, {
      type: NotificationType.REMINDER,
      title: 'Keep your streak going',
      body: 'A few minutes of learning today keeps your learning streak alive.',
    });
    this.logger.log(`Sent ${learnerIds.length} learning reminders`);
  }
}
