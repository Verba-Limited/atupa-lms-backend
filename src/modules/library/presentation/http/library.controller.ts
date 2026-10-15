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
import { PLATFORM_CONTENT_ROLES } from '../../../../shared/domain/user-role';
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
      await this.library.listVocabulary(filter, pageOf({ page, limit })),
    );
  }

  @Public()
  @Get('vocabulary/concepts/:conceptKey')
  async concept(@Param('conceptKey') conceptKey: string) {
    return ok(await this.library.getConcept(conceptKey.toLowerCase()));
  }

  @Public()
  @Get('vocabulary/:id')
  async getVocabulary(@IdParam('id') id: string) {
    return ok(await this.library.getVocabulary(id));
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
    return ok(await this.library.getTopic(id));
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

/** CMS endpoints for content creators and super admins. */
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
  async createVocabulary(@Body() dto: VocabularyDto) {
    return ok(await this.library.createVocabulary(dto), 'Vocabulary created');
  }

  @Patch('vocabulary/:id')
  async updateVocabulary(
    @IdParam('id') id: string,
    @Body() dto: UpdateVocabularyDto,
  ) {
    return ok(
      await this.library.updateVocabulary(id, dto),
      'Vocabulary updated',
    );
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
  async createTopic(@Body() dto: CulturalTopicDto) {
    return ok(await this.library.createTopic(dto), 'Cultural topic created');
  }

  @Patch('cultural-topics/:id')
  async updateTopic(
    @IdParam('id') id: string,
    @Body() dto: UpdateCulturalTopicDto,
  ) {
    return ok(
      await this.library.updateTopic(id, dto),
      'Cultural topic updated',
    );
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
  async createGame(@Body() dto: GameDto) {
    return ok(await this.library.createGame(dto), 'Game created');
  }

  @Patch('games/:id')
  async updateGame(@IdParam('id') id: string, @Body() dto: UpdateGameDto) {
    return ok(await this.library.updateGame(id, dto), 'Game updated');
  }

  @Delete('games/:id')
  async deleteGame(@IdParam('id') id: string) {
    await this.library.deleteGame(id);
    return ok(null, 'Game deleted');
  }
}
