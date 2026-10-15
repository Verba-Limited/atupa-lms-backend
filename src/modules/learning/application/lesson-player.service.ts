import { Inject, Injectable } from '@nestjs/common';
import type { Actor } from '../../../shared/application/actor';
import type { EventBus } from '../../../shared/application/event-bus.port';
import { EVENT_BUS } from '../../../shared/application/event-bus.port';
import { ActivityCompleted } from '../../../shared/contracts/events';
import {
  AnswerValue,
  CatalogQueryService,
  LearnerLessonView,
  UNGRADED_ACTIVITY_TYPES,
} from '../../catalog';
import { matchAnswer } from '../domain/answer-matcher';
import { LearningAccessService } from './learning-access.service';

export interface ActivityResult {
  activityId: string;
  correct: boolean;
  graded: boolean;
  feedback?: string;
  /** Answer key, revealed after an attempt so learners can learn from it. */
  solution?: unknown;
}

@Injectable()
export class LessonPlayerService {
  constructor(
    private readonly catalog: CatalogQueryService,
    private readonly access: LearningAccessService,
    @Inject(EVENT_BUS) private readonly events: EventBus,
  ) {}

  async getLesson(actor: Actor, lessonId: string): Promise<LearnerLessonView> {
    const view = await this.catalog.getLearnerLesson(lessonId);
    await this.access.assertCanLearn(actor, view.course);
    return view;
  }

  async submitActivity(
    actor: Actor,
    activityId: string,
    response: unknown,
  ): Promise<ActivityResult> {
    const { activity, course } =
      await this.catalog.getActivityForGrading(activityId);
    await this.access.assertCanLearn(actor, course);

    const graded =
      !UNGRADED_ACTIVITY_TYPES.includes(activity.type) &&
      activity.solution !== undefined;
    const correct = graded
      ? matchAnswer(activity.solution as AnswerValue, response, {
          ordered: activity.ordered,
        })
      : true;

    await this.events.publish(
      new ActivityCompleted(
        actor.userId,
        activity.courseId,
        activity.lessonId,
        activity.id,
        activity.type,
        correct,
      ),
    );
    return {
      activityId: activity.id,
      correct,
      graded,
      feedback: correct
        ? activity.feedback?.correct
        : activity.feedback?.incorrect,
      solution: graded ? activity.solution : undefined,
    };
  }
}
