import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { Actor } from '../../../../shared/application/actor';
import { UserRole } from '../../../../shared/domain/user-role';
import { CurrentUser } from '../../../../shared/presentation/decorators/current-user.decorator';
import { Roles } from '../../../../shared/presentation/decorators/roles.decorator';
import { ok } from '../../../../shared/presentation/http/api-response';
import { IdParam } from '../../../../shared/presentation/http/id-param';
import { CatalogQueryService } from '../../../catalog';
import { ProgressQueryService } from '../../application/progress-query.service';
import { ProgressService } from '../../application/progress.service';
import {
  HeartbeatDto,
  LessonPositionDto,
  RecentActivityQueryDto,
} from './dto/progress.dto';

@ApiTags('Progress & achievements')
@ApiBearerAuth()
@Roles(UserRole.LEARNER)
@Controller('progress')
export class ProgressController {
  constructor(
    private readonly progress: ProgressService,
    private readonly query: ProgressQueryService,
    private readonly catalog: CatalogQueryService,
  ) {}

  @Post('courses/:courseId/enroll')
  async enroll(
    @CurrentUser() actor: Actor,
    @IdParam('courseId') courseId: string,
  ) {
    return ok(await this.progress.enroll(actor.userId, courseId), 'Enrolled');
  }

  /** My courses with progress percentages. */
  @Get('courses')
  async myCourses(@CurrentUser() actor: Actor) {
    const enrollments = await this.query.listEnrollments(actor.userId);
    const courses = await this.catalog.findCourses(
      enrollments.map((e) => e.courseId),
    );
    const byId = new Map(courses.map((c) => [c.id, c]));
    return ok(
      enrollments
        .filter((e) => byId.has(e.courseId))
        .map((e) => ({ ...e, course: byId.get(e.courseId) })),
    );
  }

  @Get('courses/:courseId')
  async courseProgress(
    @CurrentUser() actor: Actor,
    @IdParam('courseId') courseId: string,
  ) {
    const [summary, lessons] = await Promise.all([
      this.query.getCourseProgress(actor.userId, courseId),
      this.query.listLessonProgress(actor.userId, courseId),
    ]);
    return ok({ ...summary, lessons });
  }

  /** Continue where I stopped (works across devices). */
  @Get('continue')
  async continueLearning(@CurrentUser() actor: Actor) {
    const latest = await this.query.getContinueLearning(actor.userId);
    if (!latest) return ok(null);
    const [lesson] = await this.catalog.findLessons([latest.lessonId]);
    const [course] = await this.catalog.findCourses([latest.courseId]);
    return ok({
      ...latest,
      lessonTitle: lesson?.title,
      courseTitle: course?.title,
    });
  }

  @Put('lessons/:lessonId/position')
  async savePosition(
    @CurrentUser() actor: Actor,
    @IdParam('lessonId') lessonId: string,
    @Body() dto: LessonPositionDto,
  ) {
    return ok(
      await this.progress.saveLessonPosition(actor.userId, lessonId, dto),
    );
  }

  @HttpCode(200)
  @Post('lessons/:lessonId/complete')
  async completeLesson(
    @CurrentUser() actor: Actor,
    @IdParam('lessonId') lessonId: string,
  ) {
    return ok(
      await this.progress.completeLesson(actor.userId, lessonId),
      'Lesson completed',
    );
  }

  @HttpCode(200)
  @Post('cultural-topics/:topicId/complete')
  async completeTopic(
    @CurrentUser() actor: Actor,
    @IdParam('topicId') topicId: string,
  ) {
    return ok(
      await this.progress.completeCulturalTopic(actor.userId, topicId),
      'Topic completed',
    );
  }

  /** Send every ~60s while the learner is active to track learning time. */
  @HttpCode(200)
  @Post('heartbeat')
  async heartbeat(@CurrentUser() actor: Actor, @Body() dto: HeartbeatDto) {
    const stats = await this.progress.recordLearningTime(
      actor.userId,
      dto.seconds,
    );
    return ok({ totalLearningSeconds: stats.totalLearningSeconds });
  }

  @Get('stats')
  async stats(@CurrentUser() actor: Actor) {
    return ok(await this.query.getStats(actor.userId));
  }

  @Get('badges')
  async badges(@CurrentUser() actor: Actor) {
    return ok(await this.query.badgeCatalog(actor.userId));
  }

  @Get('activity')
  async recentActivity(
    @CurrentUser() actor: Actor,
    @Query() query: RecentActivityQueryDto,
  ) {
    return ok(await this.query.listRecentEvents(actor.userId, query.limit));
  }

  @Get('quiz-results')
  async quizResults(@CurrentUser() actor: Actor) {
    return ok(await this.query.listQuizResults(actor.userId, 50));
  }
}
