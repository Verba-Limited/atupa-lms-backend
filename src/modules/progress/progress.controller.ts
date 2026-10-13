import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import type { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { ok } from '../../common/utils/api-response';
import { ProgressService } from './progress.service';

@ApiTags('Progress')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('progress')
export class ProgressController {
  constructor(private readonly progressService: ProgressService) {}

  @Get('dashboard')
  dashboard(@CurrentUser() user: AuthenticatedUser) {
    return this.progressService
      .getDashboard(user.userId)
      .then((data) => ok(data));
  }

  @Post('lessons')
  updateLesson(
    @CurrentUser() user: AuthenticatedUser,
    @Body()
    body: {
      courseId: string;
      lessonId: string;
      completed?: boolean;
      progressPercent?: number;
      lastBlockIndex?: number;
      lastActivityId?: string;
    },
  ) {
    return this.progressService
      .updateLessonProgress({ userId: user.userId, ...body })
      .then((data) => ok(data));
  }

  @Post('activities/complete')
  completeActivity(
    @CurrentUser() user: AuthenticatedUser,
    @Body()
    body: { courseId: string; lessonId: string; activityId: string },
  ) {
    return this.progressService
      .recordActivityCompletion({ userId: user.userId, ...body })
      .then((data) => ok(data));
  }
}
