import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { Actor } from '../../../../shared/application/actor';
import { ContentStatus } from '../../../../shared/domain/enums';
import { CONTENT_AUTHOR_ROLES } from '../../../../shared/domain/user-role';
import { CurrentUser } from '../../../../shared/presentation/decorators/current-user.decorator';
import { Roles } from '../../../../shared/presentation/decorators/roles.decorator';
import { pageOf } from '../../../../shared/presentation/dto/pagination-query.dto';
import { ok } from '../../../../shared/presentation/http/api-response';
import { IdParam } from '../../../../shared/presentation/http/id-param';
import { CourseAuthoringService } from '../../application/course-authoring.service';
import {
  ActivityDto,
  CourseQueryDto,
  CreateCourseDto,
  LessonDto,
  ModuleDto,
  QuizDto,
  UpdateActivityDto,
  UpdateCourseDto,
  UpdateLessonDto,
  UpdateModuleDto,
  UpdateQuizDto,
} from './dto/catalog.dto';

/**
 * Content management (CMS). Ownership is enforced per course: teachers
 * manage their own courses, school admins their school's courses, content
 * creators and super admins everything.
 */
@ApiTags('Authoring (CMS)')
@ApiBearerAuth()
@Roles(...CONTENT_AUTHOR_ROLES)
@Controller('authoring')
export class AuthoringController {
  constructor(private readonly authoring: CourseAuthoringService) {}

  // Courses
  @Get('courses')
  async listCourses(
    @CurrentUser() actor: Actor,
    @Query() query: CourseQueryDto,
  ) {
    const { page, limit, ...filter } = query;
    return ok(
      await this.authoring.listManageable(
        actor,
        filter,
        pageOf({ page, limit }),
      ),
    );
  }

  @Post('courses')
  async createCourse(
    @CurrentUser() actor: Actor,
    @Body() dto: CreateCourseDto,
  ) {
    return ok(await this.authoring.createCourse(actor, dto), 'Course created');
  }

  @Get('courses/:courseId')
  async getCourse(
    @CurrentUser() actor: Actor,
    @IdParam('courseId') id: string,
  ) {
    return ok(await this.authoring.getCourseTree(actor, id));
  }

  @Patch('courses/:courseId')
  async updateCourse(
    @CurrentUser() actor: Actor,
    @IdParam('courseId') id: string,
    @Body() dto: UpdateCourseDto,
  ) {
    return ok(
      await this.authoring.updateCourse(actor, id, dto),
      'Course updated',
    );
  }

  @HttpCode(200)
  @Post('courses/:courseId/publish')
  async publishCourse(
    @CurrentUser() actor: Actor,
    @IdParam('courseId') id: string,
  ) {
    return ok(
      await this.authoring.publishCourse(actor, id),
      'Course published',
    );
  }

  @HttpCode(200)
  @Post('courses/:courseId/unpublish')
  async unpublishCourse(
    @CurrentUser() actor: Actor,
    @IdParam('courseId') id: string,
  ) {
    return ok(
      await this.authoring.unpublishCourse(actor, id),
      'Course unpublished',
    );
  }

  @Delete('courses/:courseId')
  async deleteCourse(
    @CurrentUser() actor: Actor,
    @IdParam('courseId') id: string,
  ) {
    const result = await this.authoring.deleteCourse(actor, id);
    return ok(result, result.archived ? 'Course archived' : 'Course deleted');
  }

  // Modules
  @Post('courses/:courseId/modules')
  async createModule(
    @CurrentUser() actor: Actor,
    @IdParam('courseId') courseId: string,
    @Body() dto: ModuleDto,
  ) {
    return ok(
      await this.authoring.createModule(actor, courseId, dto),
      'Module created',
    );
  }

  @Patch('modules/:moduleId')
  async updateModule(
    @CurrentUser() actor: Actor,
    @IdParam('moduleId') id: string,
    @Body() dto: UpdateModuleDto,
  ) {
    return ok(
      await this.authoring.updateModule(actor, id, dto),
      'Module updated',
    );
  }

  @Delete('modules/:moduleId')
  async deleteModule(
    @CurrentUser() actor: Actor,
    @IdParam('moduleId') id: string,
  ) {
    await this.authoring.deleteModule(actor, id);
    return ok(null, 'Module deleted');
  }

  // Lessons
  @Post('modules/:moduleId/lessons')
  async createLesson(
    @CurrentUser() actor: Actor,
    @IdParam('moduleId') moduleId: string,
    @Body() dto: LessonDto,
  ) {
    return ok(
      await this.authoring.createLesson(actor, moduleId, dto),
      'Lesson created',
    );
  }

  @Patch('lessons/:lessonId')
  async updateLesson(
    @CurrentUser() actor: Actor,
    @IdParam('lessonId') id: string,
    @Body() dto: UpdateLessonDto,
  ) {
    return ok(
      await this.authoring.updateLesson(actor, id, dto),
      'Lesson updated',
    );
  }

  @HttpCode(200)
  @Post('lessons/:lessonId/publish')
  async publishLesson(
    @CurrentUser() actor: Actor,
    @IdParam('lessonId') id: string,
  ) {
    return ok(
      await this.authoring.setLessonStatus(actor, id, ContentStatus.PUBLISHED),
      'Lesson published',
    );
  }

  @HttpCode(200)
  @Post('lessons/:lessonId/unpublish')
  async unpublishLesson(
    @CurrentUser() actor: Actor,
    @IdParam('lessonId') id: string,
  ) {
    return ok(
      await this.authoring.setLessonStatus(actor, id, ContentStatus.DRAFT),
      'Lesson unpublished',
    );
  }

  @Delete('lessons/:lessonId')
  async deleteLesson(
    @CurrentUser() actor: Actor,
    @IdParam('lessonId') id: string,
  ) {
    await this.authoring.deleteLesson(actor, id);
    return ok(null, 'Lesson deleted');
  }

  // Activities
  @Post('lessons/:lessonId/activities')
  async createActivity(
    @CurrentUser() actor: Actor,
    @IdParam('lessonId') lessonId: string,
    @Body() dto: ActivityDto,
  ) {
    return ok(
      await this.authoring.createActivity(actor, lessonId, dto),
      'Activity created',
    );
  }

  @Patch('activities/:activityId')
  async updateActivity(
    @CurrentUser() actor: Actor,
    @IdParam('activityId') id: string,
    @Body() dto: UpdateActivityDto,
  ) {
    return ok(
      await this.authoring.updateActivity(actor, id, dto),
      'Activity updated',
    );
  }

  @Delete('activities/:activityId')
  async deleteActivity(
    @CurrentUser() actor: Actor,
    @IdParam('activityId') id: string,
  ) {
    await this.authoring.deleteActivity(actor, id);
    return ok(null, 'Activity deleted');
  }

  // Quizzes / assessments
  @Post('courses/:courseId/quizzes')
  async createQuiz(
    @CurrentUser() actor: Actor,
    @IdParam('courseId') courseId: string,
    @Body() dto: QuizDto,
  ) {
    return ok(
      await this.authoring.createQuiz(actor, courseId, dto),
      'Quiz created',
    );
  }

  @Get('quizzes/:quizId')
  async getQuiz(@CurrentUser() actor: Actor, @IdParam('quizId') id: string) {
    return ok(await this.authoring.getQuizForAuthor(actor, id));
  }

  @Patch('quizzes/:quizId')
  async updateQuiz(
    @CurrentUser() actor: Actor,
    @IdParam('quizId') id: string,
    @Body() dto: UpdateQuizDto,
  ) {
    return ok(await this.authoring.updateQuiz(actor, id, dto), 'Quiz updated');
  }

  @Delete('quizzes/:quizId')
  async deleteQuiz(@CurrentUser() actor: Actor, @IdParam('quizId') id: string) {
    await this.authoring.deleteQuiz(actor, id);
    return ok(null, 'Quiz deleted');
  }
}
