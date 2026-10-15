import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import {
  ActivityCompleted,
  GamecardScanned,
  GamePlayed,
  QuizAttemptSubmitted,
} from '../../../../shared/contracts/events';
import { ProgressService } from '../../application/progress.service';

/** Inbound adapter: turns learning events into progress and rewards. */
@Injectable()
export class ProgressListeners {
  constructor(private readonly progress: ProgressService) {}

  @OnEvent(ActivityCompleted.NAME, { promisify: true })
  async onActivityCompleted(event: ActivityCompleted) {
    await this.progress.recordActivity(event);
  }

  @OnEvent(QuizAttemptSubmitted.NAME, { promisify: true })
  async onQuizSubmitted(event: QuizAttemptSubmitted) {
    await this.progress.recordQuizAttempt(event);
  }

  @OnEvent(GamecardScanned.NAME, { promisify: true })
  async onGamecardScanned(event: GamecardScanned) {
    await this.progress.recordGamecardScan(
      event.userId,
      event.cardCode,
      event.rewardable,
    );
  }

  @OnEvent(GamePlayed.NAME, { promisify: true })
  async onGamePlayed(event: GamePlayed) {
    await this.progress.recordGamePlayed(
      event.userId,
      event.gameRef,
      event.scorePercent,
      event.durationSeconds,
      event.rewardable,
    );
  }
}
