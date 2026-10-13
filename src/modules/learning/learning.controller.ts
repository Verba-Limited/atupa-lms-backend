import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import type { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { ok } from '../../common/utils/api-response';
import { LearningService } from './learning.service';
import type { QuizAnswerMap } from './quiz-scoring.service';

@ApiTags('Learning')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('learning')
export class LearningController {
  constructor(private readonly learningService: LearningService) {}

  @Get('quizzes/:quizId')
  getQuiz(@Param('quizId') quizId: string) {
    return this.learningService.getQuiz(quizId).then((data) => ok(data));
  }

  @Post('quizzes/:quizId/attempts')
  submitQuiz(
    @CurrentUser() user: AuthenticatedUser,
    @Param('quizId') quizId: string,
    @Body()
    body: { answers: QuizAnswerMap; durationSeconds?: number },
  ) {
    return this.learningService
      .submitQuizAttempt({
        userId: user.userId,
        quizId,
        answers: body.answers,
        durationSeconds: body.durationSeconds,
      })
      .then((data) => ok(data));
  }

  @Get('quiz-attempts')
  listAttempts(
    @CurrentUser() user: AuthenticatedUser,
    @Query('quizId') quizId?: string,
  ) {
    return this.learningService
      .listAttempts(user.userId, quizId)
      .then((data) => ok(data));
  }
}
