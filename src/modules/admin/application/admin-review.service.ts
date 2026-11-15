import { Injectable } from '@nestjs/common';
import type { Actor } from '../../../shared/application/actor';
import { ContentStatus } from '../../../shared/domain/enums';
import { ConflictError, ValidationError } from '../../../shared/domain/errors';
import { ContentReviewService } from '../../catalog';
import { LibraryService } from '../../library';

export type LibraryKind = 'vocabulary' | 'cultural_topic' | 'game';

const QUEUE = { page: 1, limit: 100 };

/**
 * One review queue for everything that waits for a super admin (M-19):
 * courses, lessons, Public course requests and library content.
 */
@Injectable()
export class AdminReviewService {
  constructor(
    private readonly catalog: ContentReviewService,
    private readonly library: LibraryService,
  ) {}

  async queue() {
    const waiting = { status: ContentStatus.IN_REVIEW };
    const [content, vocabulary, topics, games] = await Promise.all([
      this.catalog.queue(),
      this.library.listVocabulary(waiting, QUEUE, false),
      this.library.listTopics(waiting, QUEUE, false),
      this.library.listGames(waiting, QUEUE, false),
    ]);
    return {
      ...content,
      library: [
        ...vocabulary.items.map((v) => ({
          type: 'vocabulary' as const,
          id: v.id,
          title: `${v.term} (${v.meaning})`,
          languageCode: v.languageCode,
        })),
        ...topics.items.map((t) => ({
          type: 'cultural_topic' as const,
          id: t.id,
          title: t.title,
        })),
        ...games.items.map((g) => ({
          type: 'game' as const,
          id: g.id,
          title: g.title,
        })),
      ],
      totals: {
        ...content.totals,
        library: vocabulary.total + topics.total + games.total,
      },
    };
  }

  decideCourse(actor: Actor, id: string, approve: boolean, comment?: string) {
    return approve
      ? this.catalog.approveCourse(actor, id, comment)
      : this.catalog.rejectCourse(actor, id, requireComment(comment));
  }

  decideLesson(actor: Actor, id: string, approve: boolean, comment?: string) {
    return approve
      ? this.catalog.approveLesson(actor, id, comment)
      : this.catalog.rejectLesson(actor, id, requireComment(comment));
  }

  decidePublic(actor: Actor, id: string, approve: boolean, comment?: string) {
    return approve
      ? this.catalog.approvePublic(actor, id, comment)
      : this.catalog.rejectPublic(actor, id, requireComment(comment));
  }

  /** Approve publishes the item; reject sends it back to draft. */
  async decideLibrary(kind: LibraryKind, id: string, approve: boolean) {
    const status = approve ? ContentStatus.PUBLISHED : ContentStatus.DRAFT;
    switch (kind) {
      case 'vocabulary': {
        await this.assertInReview(
          (await this.library.getVocabulary(id, false)).status,
        );
        return this.library.updateVocabulary(id, { status });
      }
      case 'cultural_topic': {
        await this.assertInReview(
          (await this.library.getTopic(id, false)).status,
        );
        return this.library.updateTopic(id, { status });
      }
      case 'game': {
        await this.assertInReview(
          (await this.library.getGame(id, false)).status,
        );
        return this.library.updateGame(id, { status });
      }
    }
  }

  private assertInReview(status: ContentStatus): Promise<void> {
    if (status !== ContentStatus.IN_REVIEW) {
      throw new ConflictError('This item is not waiting for review');
    }
    return Promise.resolve();
  }
}

function requireComment(comment?: string): string {
  if (!comment?.trim()) {
    throw new ValidationError('Say what needs to change when rejecting');
  }
  return comment;
}
