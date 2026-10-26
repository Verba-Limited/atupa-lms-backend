import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { memoryStorage } from 'multer';
import type { Actor } from '../../../../shared/application/actor';
import { CurrentUser } from '../../../../shared/presentation/decorators/current-user.decorator';
import { pageOf } from '../../../../shared/presentation/dto/pagination-query.dto';
import { ok } from '../../../../shared/presentation/http/api-response';
import { IdParam } from '../../../../shared/presentation/http/id-param';
import { MediaService } from '../../application/media.service';
import { MAX_SERVER_UPLOAD_BYTES } from '../../domain/media-asset.entity';
import {
  ConfirmUploadDto,
  ListMediaQueryDto,
  PlaybackLookupDto,
  RequestUploadDto,
  ServerUploadDto,
} from './dto/media.dto';

const UPLOAD_RATE_LIMIT = { default: { limit: 30, ttl: 60_000 } };

@ApiTags('Media')
@ApiBearerAuth()
@Controller('media')
export class MediaController {
  constructor(private readonly media: MediaService) {}

  /**
   * Direct upload, step 1. POST the file with the returned `fields` to
   * `uploadUrl` (multipart, field name "file"), then call /media/uploads/confirm.
   * If `mode` is "server", upload to POST /media/upload instead.
   */
  @Throttle(UPLOAD_RATE_LIMIT)
  @Post('uploads')
  async requestUpload(
    @CurrentUser() actor: Actor,
    @Body() dto: RequestUploadDto,
  ) {
    return ok(await this.media.requestUpload(actor, dto.kind, dto.purpose));
  }

  /** Direct upload, step 2: register the uploaded file. */
  @Throttle(UPLOAD_RATE_LIMIT)
  @Post('uploads/confirm')
  async confirmUpload(
    @CurrentUser() actor: Actor,
    @Body() dto: ConfirmUploadDto,
  ) {
    return ok(await this.media.confirmUpload(actor, dto), 'Media saved');
  }

  /** Upload through the API (files up to 25MB). */
  @Throttle(UPLOAD_RATE_LIMIT)
  @Post('upload')
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
        purpose: { type: 'string', enum: ['content', 'profile', 'submission'] },
      },
    },
  })
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: MAX_SERVER_UPLOAD_BYTES, files: 1 },
    }),
  )
  async upload(
    @CurrentUser() actor: Actor,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body() dto: ServerUploadDto,
  ) {
    if (!file) throw new BadRequestException('A file is required');
    return ok(
      await this.media.uploadViaServer(actor, file, dto.purpose),
      'Media saved',
    );
  }

  @Get()
  async list(@CurrentUser() actor: Actor, @Query() query: ListMediaQueryDto) {
    return ok(
      await this.media.list(
        actor,
        { kind: query.kind, all: query.all },
        pageOf(query),
      ),
    );
  }

  /**
   * Playback details for media URLs found in lessons, vocabulary, quizzes
   * and activities. Returns `{ [url]: playback }`.
   */
  @HttpCode(200)
  @Post('playback')
  async playbackLookup(@Body() dto: PlaybackLookupDto) {
    return ok(Object.fromEntries(await this.media.resolveUrls(dto.urls)));
  }

  /** Playback details (sources, poster, duration) for one media item. */
  @Get(':id/playback')
  async playback(@CurrentUser() actor: Actor, @IdParam('id') id: string) {
    return ok(await this.media.getPlayback(actor, id));
  }

  @Get(':id')
  async get(@CurrentUser() actor: Actor, @IdParam('id') id: string) {
    return ok(await this.media.get(actor, id));
  }

  @Delete(':id')
  async remove(@CurrentUser() actor: Actor, @IdParam('id') id: string) {
    await this.media.remove(actor, id);
    return ok(null, 'Media deleted');
  }
}
