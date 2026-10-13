import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import type { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { ok } from '../../common/utils/api-response';
import { GamecardService } from './gamecard.service';

@ApiTags('GameCard')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('gamecard')
export class GamecardController {
  constructor(private readonly gamecardService: GamecardService) {}

  @Post('scan')
  scan(
    @CurrentUser() user: AuthenticatedUser,
    @Body()
    body: {
      qrPayload: string;
      languageCode?: string;
      word?: string;
      lessonId?: string;
    },
  ) {
    return this.gamecardService
      .recordScan({ userId: user.userId, ...body })
      .then((data) => ok(data));
  }

  @Get('scans')
  scans(@CurrentUser() user: AuthenticatedUser) {
    return this.gamecardService
      .listScans(user.userId)
      .then((data) => ok(data));
  }
}
