import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Actor } from '../../../../shared/application/actor';
import {
  PLATFORM_CONTENT_ROLES,
  UserRole,
} from '../../../../shared/domain/user-role';
import { CurrentUser } from '../../../../shared/presentation/decorators/current-user.decorator';
import { Roles } from '../../../../shared/presentation/decorators/roles.decorator';
import { pageOf } from '../../../../shared/presentation/dto/pagination-query.dto';
import { ok } from '../../../../shared/presentation/http/api-response';
import { IdParam } from '../../../../shared/presentation/http/id-param';
import { GamecardService } from '../../application/gamecard.service';
import {
  CardsQueryDto,
  ChallengeAnswerDto,
  GameCardDto,
  GameSessionDto,
  PlaysQueryDto,
  ScanDto,
  UpdateGameCardDto,
} from './dto/gamecard.dto';

const PLAY_RATE_LIMIT = { default: { limit: 60, ttl: 60_000 } };

@ApiTags('ATUPA GameCard & games')
@ApiBearerAuth()
@Controller()
export class GamecardController {
  constructor(private readonly gamecard: GamecardService) {}

  @Get('gamecard/cards/:code')
  async card(@Param('code') code: string) {
    return ok(await this.gamecard.getCardView(code));
  }

  /** Scan a card QR: returns pronunciation + challenge and records progress. */
  @Roles(UserRole.LEARNER)
  @Throttle(PLAY_RATE_LIMIT)
  @HttpCode(200)
  @Post('gamecard/scan')
  async scan(@CurrentUser() actor: Actor, @Body() dto: ScanDto) {
    return ok(await this.gamecard.scan(actor, dto.code));
  }

  @Roles(UserRole.LEARNER)
  @Throttle(PLAY_RATE_LIMIT)
  @HttpCode(200)
  @Post('gamecard/cards/:code/challenge')
  async challenge(
    @CurrentUser() actor: Actor,
    @Param('code') code: string,
    @Body() dto: ChallengeAnswerDto,
  ) {
    return ok(await this.gamecard.answerChallenge(actor, code, dto.answer));
  }

  @Roles(UserRole.LEARNER)
  @Get('gamecard/plays')
  async myPlays(@CurrentUser() actor: Actor, @Query() query: PlaysQueryDto) {
    return ok(
      await this.gamecard.listMyPlays(actor, query.kind, pageOf(query)),
    );
  }

  /** Game performance reported by an ATUPA game, reflected in LMS progress. */
  @Roles(UserRole.LEARNER)
  @Throttle(PLAY_RATE_LIMIT)
  @Post('games/:gameId/sessions')
  async gameSession(
    @CurrentUser() actor: Actor,
    @IdParam('gameId') gameId: string,
    @Body() dto: GameSessionDto,
  ) {
    return ok(await this.gamecard.recordGameSession(actor, gameId, dto));
  }
}

@ApiTags('Authoring (CMS)')
@ApiBearerAuth()
@Roles(...PLATFORM_CONTENT_ROLES)
@Controller('authoring/gamecards')
export class GamecardAuthoringController {
  constructor(private readonly gamecard: GamecardService) {}

  @Get()
  async list(@Query() query: CardsQueryDto) {
    const { languageCode, conceptKey } = query;
    return ok(
      await this.gamecard.listCards(
        { languageCode, conceptKey },
        pageOf(query),
      ),
    );
  }

  @Post()
  async create(@Body() dto: GameCardDto) {
    return ok(await this.gamecard.createCard(dto), 'GameCard created');
  }

  @Patch(':code')
  async update(@Param('code') code: string, @Body() dto: UpdateGameCardDto) {
    return ok(await this.gamecard.updateCard(code, dto), 'GameCard updated');
  }

  @Delete(':code')
  async remove(@Param('code') code: string) {
    await this.gamecard.deleteCard(code);
    return ok(null, 'GameCard deleted');
  }

  /** Printable QR for the physical card. */
  @Get(':code/qr')
  async qr(@Param('code') code: string) {
    return ok(await this.gamecard.cardQr(code));
  }
}
