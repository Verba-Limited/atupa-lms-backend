import { Inject, Injectable } from '@nestjs/common';
import type { Actor } from '../../../shared/application/actor';
import type { EventBus } from '../../../shared/application/event-bus.port';
import { EVENT_BUS } from '../../../shared/application/event-bus.port';
import type { QrCodeGenerator } from '../../../shared/application/qr-code.port';
import { QR_CODE_GENERATOR } from '../../../shared/application/qr-code.port';
import { GamecardScanned, GamePlayed } from '../../../shared/contracts/events';
import {
  ConflictError,
  NotFoundError,
  PaymentRequiredError,
} from '../../../shared/domain/errors';
import { PageRequest } from '../../../shared/domain/pagination';
import { todayKey } from '../../../shared/domain/text';
import { CatalogQueryService } from '../../catalog';
import { matchAnswer } from '../../learning';
import { LibraryService } from '../../library';
import { SubscriptionsService } from '../../subscriptions';
import {
  GameCard,
  normalizeCardCode,
  PlayKind,
  toLearnerChallenge,
} from '../domain/gamecard.entities';
import type {
  GameCardRepository,
  PlayRecordRepository,
} from './ports/gamecard.ports';
import {
  GAMECARD_REPOSITORY,
  PLAY_RECORD_REPOSITORY,
} from './ports/gamecard.ports';

export const GAMECARD_SCAN_BASE_URL = Symbol('GAMECARD_SCAN_BASE_URL');

export type GameCardInput = Omit<GameCard, 'id' | 'isActive'> & {
  isActive?: boolean;
};

@Injectable()
export class GamecardService {
  constructor(
    @Inject(GAMECARD_REPOSITORY) private readonly cards: GameCardRepository,
    @Inject(PLAY_RECORD_REPOSITORY)
    private readonly plays: PlayRecordRepository,
    @Inject(QR_CODE_GENERATOR) private readonly qr: QrCodeGenerator,
    @Inject(GAMECARD_SCAN_BASE_URL) private readonly scanBaseUrl: string,
    @Inject(EVENT_BUS) private readonly events: EventBus,
    private readonly library: LibraryService,
    private readonly catalog: CatalogQueryService,
    private readonly subscriptions: SubscriptionsService,
  ) {}

  /** What the learner sees after scanning: word, translations, audio, challenge. */
  async getCardView(code: string) {
    const card = await this.requireActiveCard(code);
    const [translations, lessons] = await Promise.all([
      this.library.getConcept(card.conceptKey),
      this.catalog.listPublishedLessons({ gamecardCode: card.code }, 10),
    ]);
    return {
      code: card.code,
      title: card.title,
      description: card.description,
      imageUrl: card.imageUrl,
      languageCode: card.languageCode,
      conceptKey: card.conceptKey,
      word:
        translations.find((t) => t.languageCode === card.languageCode) ?? null,
      translations,
      challenge: toLearnerChallenge(card.challenge),
      lessons: lessons.map((l) => ({
        id: l.id,
        courseId: l.courseId,
        title: l.title,
      })),
    };
  }

  async scan(actor: Actor, code: string) {
    const view = await this.getCardView(code);
    const play = await this.plays.record(
      this.playInput(actor, 'scan', view.code, {
        languageCode: view.languageCode,
      }),
      true,
    );
    await this.events.publish(
      new GamecardScanned(
        actor.userId,
        view.code,
        view.languageCode,
        play.rewarded,
      ),
    );
    return { card: view, rewarded: play.rewarded };
  }

  async answerChallenge(actor: Actor, code: string, answer: string) {
    const card = await this.requireActiveCard(code);
    if (!card.challenge) throw new NotFoundError('This card has no challenge');
    const correct = matchAnswer(card.challenge.answer, answer);
    const play = await this.plays.record(
      this.playInput(actor, 'challenge', card.code, {
        languageCode: card.languageCode,
        correct,
        scorePercent: correct ? 100 : 0,
      }),
      correct,
    );
    await this.events.publish(
      new GamePlayed(
        actor.userId,
        `card:${card.code}`,
        correct ? 100 : 0,
        0,
        play.rewarded,
      ),
    );
    return {
      correct,
      correctAnswer: card.challenge.answer,
      explanation: card.challenge.explanation,
      rewarded: play.rewarded,
    };
  }

  /** Score report from an ATUPA game (web/mobile) for LMS progress. */
  async recordGameSession(
    actor: Actor,
    gameId: string,
    input: { scorePercent: number; durationSeconds: number },
  ) {
    const game = await this.library.getGame(gameId);
    if (
      game.isPremium &&
      !(await this.subscriptions.hasPremiumAccess(actor.userId, actor.schoolId))
    ) {
      throw new PaymentRequiredError('This game is part of Premium');
    }
    const play = await this.plays.record(
      this.playInput(actor, 'game', game.id, {
        scorePercent: input.scorePercent,
        durationSeconds: input.durationSeconds,
      }),
      true,
    );
    await this.events.publish(
      new GamePlayed(
        actor.userId,
        game.id,
        input.scorePercent,
        input.durationSeconds,
        play.rewarded,
      ),
    );
    return { gameId: game.id, rewarded: play.rewarded };
  }

  listMyPlays(actor: Actor, kind: PlayKind | undefined, page: PageRequest) {
    return this.plays.listByUser(actor.userId, kind, page);
  }

  countPlays(filter: { kind?: PlayKind; since?: Date; userIds?: string[] }) {
    return this.plays.count(filter);
  }

  // ---- CMS ------------------------------------------------------------------

  listCards(
    filter: { languageCode?: string; conceptKey?: string },
    page: PageRequest,
  ) {
    return this.cards.list(filter, page);
  }

  async createCard(input: GameCardInput): Promise<GameCard> {
    const code = normalizeCardCode(input.code);
    if (await this.cards.findByCode(code)) {
      throw new ConflictError(`GameCard ${code} already exists`);
    }
    return this.cards.create({
      ...input,
      code,
      conceptKey: input.conceptKey.toLowerCase(),
      languageCode: input.languageCode.toLowerCase(),
      isActive: input.isActive ?? true,
    });
  }

  async updateCard(
    code: string,
    patch: Partial<GameCardInput>,
  ): Promise<GameCard> {
    const { code: _ignored, ...rest } = patch;
    void _ignored;
    const updated = await this.cards.updateByCode(
      normalizeCardCode(code),
      rest,
    );
    if (!updated) throw new NotFoundError('GameCard not found');
    return updated;
  }

  async deleteCard(code: string): Promise<void> {
    if (!(await this.cards.deleteByCode(normalizeCardCode(code)))) {
      throw new NotFoundError('GameCard not found');
    }
  }

  /** QR to print on the physical card; opens the web app's scan page. */
  async cardQr(code: string) {
    const card = await this.cards.findByCode(normalizeCardCode(code));
    if (!card) throw new NotFoundError('GameCard not found');
    const scanUrl = `${this.scanBaseUrl}/${encodeURIComponent(card.code)}`;
    return {
      code: card.code,
      scanUrl,
      qrCodeDataUrl: await this.qr.toDataUrl(scanUrl),
    };
  }

  private async requireActiveCard(code: string): Promise<GameCard> {
    const card = await this.cards.findByCode(normalizeCardCode(code));
    if (!card || !card.isActive) throw new NotFoundError('Unknown GameCard');
    return card;
  }

  private playInput(
    actor: Actor,
    kind: PlayKind,
    ref: string,
    extra: {
      languageCode?: string;
      correct?: boolean;
      scorePercent?: number;
      durationSeconds?: number;
    },
  ) {
    const now = new Date();
    return {
      userId: actor.userId,
      kind,
      ref,
      ...extra,
      day: todayKey(now),
      at: now,
    };
  }
}
