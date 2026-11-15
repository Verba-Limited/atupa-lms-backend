import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { Actor } from '../../../../shared/application/actor';
import { ContentStatus } from '../../../../shared/domain/enums';
import {
  PLATFORM_CONTENT_ROLES,
  UserRole,
} from '../../../../shared/domain/user-role';
import { CurrentUser } from '../../../../shared/presentation/decorators/current-user.decorator';
import { Public } from '../../../../shared/presentation/decorators/public.decorator';
import { Roles } from '../../../../shared/presentation/decorators/roles.decorator';
import { pageOf } from '../../../../shared/presentation/dto/pagination-query.dto';
import { ok } from '../../../../shared/presentation/http/api-response';
import { IdParam } from '../../../../shared/presentation/http/id-param';
import { LibraryService } from '../../application/library.service';
import {
  CulturalTopicDto,
  CulturalTopicQueryDto,
  GameDto,
  GameQueryDto,
  UpdateCulturalTopicDto,
  UpdateGameDto,
  UpdateVocabularyDto,
  VocabularyDto,
  VocabularyQueryDto,
} from './dto/library.dto';

@ApiTags('Library (vocabulary, culture, games)')
@Controller()
export class LibraryController {
  constructor(private readonly library: LibraryService) {}

  // ---- Learner-facing reads (published only) ----

  @Public()
  @Get('vocabulary')
  async listVocabulary(@Query() query: VocabularyQueryDto) {
    const { page, limit, ...filter } = query;
    return ok(
      await this.library.listVocabularyView(filter, pageOf({ page, limit })),
    );
  }

  @Public()
  @Get('vocabulary/concepts/:conceptKey')
  async concept(@Param('conceptKey') conceptKey: string) {
    return ok(await this.library.getConceptView(conceptKey.toLowerCase()));
  }

  @Public()
  @Get('vocabulary/:id')
  async getVocabulary(@IdParam('id') id: string) {
    return ok(await this.library.getVocabularyView(id));
  }

  @Public()
  @Get('cultural-topics')
  async listTopics(@Query() query: CulturalTopicQueryDto) {
    const { page, limit, ...filter } = query;
    return ok(await this.library.listTopics(filter, pageOf({ page, limit })));
  }

  @Public()
  @Get('cultural-topics/:id')
  async getTopic(@IdParam('id') id: string) {
    return ok(await this.library.getTopicView(id));
  }

  @Public()
  @Get('games')
  async listGames(@Query() query: GameQueryDto) {
    const { page, limit, ...filter } = query;
    return ok(await this.library.listGames(filter, pageOf({ page, limit })));
  }

  @Public()
  @Get('games/:id')
  async getGame(@IdParam('id') id: string) {
    return ok(await this.library.getGame(id));
  }
}

/**
 * Only super admins publish library content directly. Anything another staff
 * member publishes waits in review until a super admin approves it (M-19).
 */
function reviewedStatus(actor: Actor, requested: ContentStatus): ContentStatus {
  return requested === ContentStatus.PUBLISHED &&
    actor.role !== UserRole.SUPER_ADMIN
    ? ContentStatus.IN_REVIEW
    : requested;
}

function savedMessage(message: string, status: ContentStatus): string {
  return status === ContentStatus.IN_REVIEW
    ? `${message} and sent for review`
    : message;
}

/** CMS endpoints for content creators, support admins and super admins. */
@ApiTags('Authoring (CMS)')
@ApiBearerAuth()
@Roles(...PLATFORM_CONTENT_ROLES)
@Controller('authoring')
export class LibraryAuthoringController {
  constructor(private readonly library: LibraryService) {}

  @Get('vocabulary')
  async listVocabulary(@Query() query: VocabularyQueryDto) {
    const { page, limit, ...filter } = query;
    return ok(
      await this.library.listVocabulary(filter, pageOf({ page, limit }), false),
    );
  }

  @Post('vocabulary')
  async createVocabulary(
    @CurrentUser() actor: Actor,
    @Body() dto: VocabularyDto,
  ) {
    const entry = await this.library.createVocabulary({
      ...dto,
      status: reviewedStatus(actor, dto.status ?? ContentStatus.PUBLISHED),
    });
    return ok(entry, savedMessage('Vocabulary created', entry.status));
  }

  @Patch('vocabulary/:id')
  async updateVocabulary(
    @CurrentUser() actor: Actor,
    @IdParam('id') id: string,
    @Body() dto: UpdateVocabularyDto,
  ) {
    const entry = await this.library.updateVocabulary(id, {
      ...dto,
      ...(dto.status ? { status: reviewedStatus(actor, dto.status) } : {}),
    });
    return ok(entry, savedMessage('Vocabulary updated', entry.status));
  }

  @Delete('vocabulary/:id')
  async deleteVocabulary(@IdParam('id') id: string) {
    await this.library.deleteVocabulary(id);
    return ok(null, 'Vocabulary deleted');
  }

  @Get('cultural-topics')
  async listTopics(@Query() query: CulturalTopicQueryDto) {
    const { page, limit, ...filter } = query;
    return ok(
      await this.library.listTopics(filter, pageOf({ page, limit }), false),
    );
  }

  @Post('cultural-topics')
  async createTopic(
    @CurrentUser() actor: Actor,
    @Body() dto: CulturalTopicDto,
  ) {
    const topic = await this.library.createTopic({
      ...dto,
      ...(dto.status ? { status: reviewedStatus(actor, dto.status) } : {}),
    });
    return ok(topic, savedMessage('Cultural topic created', topic.status));
  }

  @Patch('cultural-topics/:id')
  async updateTopic(
    @CurrentUser() actor: Actor,
    @IdParam('id') id: string,
    @Body() dto: UpdateCulturalTopicDto,
  ) {
    const topic = await this.library.updateTopic(id, {
      ...dto,
      ...(dto.status ? { status: reviewedStatus(actor, dto.status) } : {}),
    });
    return ok(topic, savedMessage('Cultural topic updated', topic.status));
  }

  @Delete('cultural-topics/:id')
  async deleteTopic(@IdParam('id') id: string) {
    await this.library.deleteTopic(id);
    return ok(null, 'Cultural topic deleted');
  }

  @Get('games')
  async listGames(@Query() query: GameQueryDto) {
    const { page, limit, ...filter } = query;
    return ok(
      await this.library.listGames(filter, pageOf({ page, limit }), false),
    );
  }

  @Post('games')
  async createGame(@CurrentUser() actor: Actor, @Body() dto: GameDto) {
    const game = await this.library.createGame({
      ...dto,
      ...(dto.status ? { status: reviewedStatus(actor, dto.status) } : {}),
    });
    return ok(game, savedMessage('Game created', game.status));
  }

  @Patch('games/:id')
  async updateGame(
    @CurrentUser() actor: Actor,
    @IdParam('id') id: string,
    @Body() dto: UpdateGameDto,
  ) {
    const game = await this.library.updateGame(id, {
      ...dto,
      ...(dto.status ? { status: reviewedStatus(actor, dto.status) } : {}),
    });
    return ok(game, savedMessage('Game updated', game.status));
  }

  @Delete('games/:id')
  async deleteGame(@IdParam('id') id: string) {
    await this.library.deleteGame(id);
    return ok(null, 'Game deleted');
  }
}
