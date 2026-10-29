import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { QuizAttemptsService } from '../../application/quiz-attempts.service';

/**
 * Every minute: close timed attempts whose timer ran out without a
 * submission, so they are recorded as expired instead of staying open.
 */
@Injectable()
export class ExpireAttemptsJob {
  private readonly logger = new Logger(ExpireAttemptsJob.name);

  constructor(private readonly attempts: QuizAttemptsService) {}

  @Cron(CronExpression.EVERY_MINUTE, { name: 'expire-quiz-attempts' })
  async run(): Promise<void> {
    const count = await this.attempts.expireOverdue();
    if (count) this.logger.log(`Expired ${count} overdue quiz attempts`);
  }
}
