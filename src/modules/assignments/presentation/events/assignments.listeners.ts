import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import {
  GamePlayed,
  LessonCompleted,
  QuizAttemptSubmitted,
} from '../../../../shared/contracts/events';
import { AssignmentsService } from '../../application/assignments.service';
import { AssignmentType } from '../../domain/assignment.entities';

/** Auto-completes lesson/quiz/game assignments from learning events. */
@Injectable()
export class AssignmentsListeners {
  constructor(private readonly assignments: AssignmentsService) {}

  @OnEvent(LessonCompleted.NAME, { promisify: true })
  async onLessonCompleted(event: LessonCompleted) {
    await this.assignments.autoComplete(
      event.userId,
      AssignmentType.LESSON,
      event.lessonId,
    );
  }

  @OnEvent(QuizAttemptSubmitted.NAME, { promisify: true })
  async onQuizSubmitted(event: QuizAttemptSubmitted) {
    if (event.passed) {
      await this.assignments.autoComplete(
        event.userId,
        AssignmentType.QUIZ,
        event.quizId,
      );
    }
  }

  @OnEvent(GamePlayed.NAME, { promisify: true })
  async onGamePlayed(event: GamePlayed) {
    await this.assignments.autoComplete(
      event.userId,
      AssignmentType.GAME,
      event.gameRef,
    );
  }
}
