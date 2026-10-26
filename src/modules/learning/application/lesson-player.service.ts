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
import { ContentStatus } from '../../../shared/domain/enums';
import { LibraryService } from '../../library';
import {
  externalPlayback,
  MediaKind,
  MediaPlayback,
  MediaService,
} from '../../media';
import { matchAnswer } from '../domain/answer-matcher';
import { LearningAccessService } from './learning-access.service';

const BLOCK_KIND: Record<string, MediaKind> = {
  image: MediaKind.IMAGE,
  audio: MediaKind.AUDIO,
  pronunciation: MediaKind.AUDIO,
  video: MediaKind.VIDEO,
};

function blockPlayback(
  type: string,
  url: string | undefined,
  resolved: Map<string, MediaPlayback>,
): MediaPlayback | null {
  if (!url) return null;
  const found = resolved.get(url);
  if (found) return found;
  return BLOCK_KIND[type] ? externalPlayback(url, BLOCK_KIND[type]) : null;
}

/** http(s) links anywhere inside an activity payload (audio, images...). */
export function mediaUrlsIn(value: unknown, found: string[] = []): string[] {
  if (typeof value === 'string') {
    if (/^https?:\/\//i.test(value)) found.push(value);
  } else if (Array.isArray(value)) {
    value.forEach((v) => mediaUrlsIn(v, found));
  } else if (value && typeof value === 'object') {
    Object.values(value).forEach((v) => mediaUrlsIn(v, found));
  }
  return found;
}

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
    private readonly media: MediaService,
    private readonly library: LibraryService,
  ) {}

  /**
   * The lesson as a learner sees it, with playable media everywhere:
   * `media` on each image/audio/video block, vocabulary with pronunciation
   * audio, and the media used inside each activity.
   */
  async getLesson(actor: Actor, lessonId: string) {
    const view = await this.catalog.getLearnerLesson(lessonId);
    await this.access.assertCanLearn(actor, view.course);

    const [vocabulary, playback] = await Promise.all([
      this.lessonVocabulary(view),
      this.media.resolveUrls([
        ...view.lesson.blocks.map((b) => b.mediaUrl),
        ...view.activities.flatMap((a) => mediaUrlsIn(a.payload)),
      ]),
    ]);

    return {
      ...view,
      lesson: {
        ...view.lesson,
        blocks: view.lesson.blocks.map((b) => ({
          ...b,
          media: blockPlayback(b.type, b.mediaUrl, playback),
        })),
      },
      activities: view.activities.map((a) => ({
        ...a,
        media: mediaUrlsIn(a.payload)
          .map((u) => playback.get(u))
          .filter((m): m is MediaPlayback => !!m),
      })),
      vocabulary,
    };
  }

  private async lessonVocabulary(view: LearnerLessonView) {
    if (!view.lesson.vocabularyIds.length) return [];
    const entries = await this.library.findVocabularyByIds(
      view.lesson.vocabularyIds,
    );
    return this.library.withMedia(
      entries.filter((e) => e.status === ContentStatus.PUBLISHED),
    );
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
