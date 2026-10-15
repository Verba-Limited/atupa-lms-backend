import { Controller, Get, HttpCode, Patch, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional } from 'class-validator';
import type { Actor } from '../../../../shared/application/actor';
import { CurrentUser } from '../../../../shared/presentation/decorators/current-user.decorator';
import {
  pageOf,
  PaginationQueryDto,
} from '../../../../shared/presentation/dto/pagination-query.dto';
import { ok } from '../../../../shared/presentation/http/api-response';
import { IdParam } from '../../../../shared/presentation/http/id-param';
import { NotificationsService } from '../../application/notifications.service';

export class NotificationsQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  unreadOnly?: boolean;
}

@ApiTags('Notifications')
@ApiBearerAuth()
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get()
  async list(
    @CurrentUser() actor: Actor,
    @Query() query: NotificationsQueryDto,
  ) {
    return ok(
      await this.notifications.list(actor, !!query.unreadOnly, pageOf(query)),
    );
  }

  @Get('unread-count')
  async unread(@CurrentUser() actor: Actor) {
    return ok({ count: await this.notifications.countUnread(actor) });
  }

  @HttpCode(200)
  @Patch('read-all')
  async readAll(@CurrentUser() actor: Actor) {
    return ok({ updated: await this.notifications.markAllRead(actor) });
  }

  @HttpCode(200)
  @Patch(':id/read')
  async read(@CurrentUser() actor: Actor, @IdParam('id') id: string) {
    await this.notifications.markRead(actor, id);
    return ok(null, 'Marked as read');
  }
}
