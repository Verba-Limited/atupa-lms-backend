import { Body, Controller, Get, HttpCode, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiQuery, ApiTags } from '@nestjs/swagger';
import type { Actor } from '../../../../shared/application/actor';
import { CurrentUser } from '../../../../shared/presentation/decorators/current-user.decorator';
import { ok } from '../../../../shared/presentation/http/api-response';
import { IdParam } from '../../../../shared/presentation/http/id-param';
import { ParseObjectIdPipe } from '../../../../shared/presentation/pipes/parse-object-id.pipe';
import { LessonPlayerService } from '../../application/lesson-player.service';
import { QuizAttemptsService } from '../../application/quiz-attempts.service';
import { SubmitActivityDto, SubmitQuizDto } from './dto/learning.dto';

@ApiTags('Learning')
@ApiBearerAuth()
@Controller('learning')
export class LearningController {
  constructor(
    private readonly lessons: LessonPlayerService,
    private readonly quizzes: QuizAttemptsService,
  ) {}

  /** Full lesson content (text, media, vocabulary...) with activities, no answers. */
  @Get('lessons/:lessonId')
  async lesson(
    @CurrentUser() actor: Actor,
    @IdParam('lessonId') lessonId: string,
  ) {
    return ok(await this.lessons.getLesson(actor, lessonId));
  }

  @HttpCode(200)
  @Post('activities/:activityId/submit')
  async submitActivity(
    @CurrentUser() actor: Actor,
    @IdParam('activityId') activityId: string,
    @Body() dto: SubmitActivityDto,
  ) {
    return ok(
      await this.lessons.submitActivity(actor, activityId, dto.response),
    );
  }

  /** Starts or resumes an attempt; returns questions in this attempt's order. */
  @Post('quizzes/:quizId/attempts')
  async startQuiz(
    @CurrentUser() actor: Actor,
    @IdParam('quizId') quizId: string,
  ) {
    return ok(await this.quizzes.start(actor, quizId));
  }

  @HttpCode(200)
  @Post('attempts/:attemptId/submit')
  async submitQuiz(
    @CurrentUser() actor: Actor,
    @IdParam('attemptId') attemptId: string,
    @Body() dto: SubmitQuizDto,
  ) {
    return ok(await this.quizzes.submit(actor, attemptId, dto.answers));
  }

  @Get('attempts/:attemptId/review')
  async review(
    @CurrentUser() actor: Actor,
    @IdParam('attemptId') attemptId: string,
  ) {
    return ok(await this.quizzes.review(actor, attemptId));
  }

  @ApiQuery({ name: 'quizId', required: false })
  @Get('attempts')
  async myAttempts(
    @CurrentUser() actor: Actor,
    @Query('quizId', new ParseObjectIdPipe({ optional: true })) quizId?: string,
  ) {
    return ok(await this.quizzes.listMine(actor, quizId));
  }
}
