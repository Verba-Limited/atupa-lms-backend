import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { ProficiencyLevel } from '../../common/enums/proficiency-level.enum';
import { UserRole } from '../../common/enums/user-role.enum';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import type { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { ok } from '../../common/utils/api-response';
import { CatalogService } from './catalog.service';
import { ActivityType } from './schemas/activity.schema';

@ApiTags('Catalog')
@Controller()
export class CatalogController {
  constructor(private readonly catalogService: CatalogService) {}

  @Get('languages')
  listLanguages() {
    return this.catalogService.listLanguages().then((data) => ok(data));
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.CONTENT_CREATOR)
  @Post('languages')
  createLanguage(@Body() body: { code: string; name: string }) {
    return this.catalogService.createLanguage(body).then((data) => ok(data));
  }

  @Get('courses')
  listCourses(
    @Query('languageCode') languageCode?: string,
    @Query('level') level?: ProficiencyLevel,
  ) {
    return this.catalogService
      .listCourses({ languageCode, level })
      .then((data) => ok(data));
  }

  @Get('courses/:courseId')
  getCourse(@Param('courseId') courseId: string) {
    return this.catalogService
      .getCourseTree(courseId, false)
      .then((data) => ok(data));
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(
    UserRole.TEACHER,
    UserRole.CONTENT_CREATOR,
    UserRole.SCHOOL_ADMIN,
    UserRole.SUPER_ADMIN,
  )
  @Post('courses')
  createCourse(
    @CurrentUser() user: AuthenticatedUser,
    @Body()
    body: {
      languageCode: string;
      level: ProficiencyLevel;
      title: string;
      description?: string;
      ageGroup?: string;
      durationMinutes?: number;
    },
  ) {
    return this.catalogService
      .createCourse(user.role, { ...body, createdByUserId: user.userId })
      .then((data) => ok(data));
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(
    UserRole.TEACHER,
    UserRole.CONTENT_CREATOR,
    UserRole.SCHOOL_ADMIN,
    UserRole.SUPER_ADMIN,
  )
  @Patch('courses/:courseId/publish')
  publishCourse(
    @CurrentUser() user: AuthenticatedUser,
    @Param('courseId') courseId: string,
  ) {
    return this.catalogService
      .publishCourse(user.role, courseId)
      .then((data) => ok(data));
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(
    UserRole.TEACHER,
    UserRole.CONTENT_CREATOR,
    UserRole.SCHOOL_ADMIN,
    UserRole.SUPER_ADMIN,
  )
  @Patch('courses/:courseId/unpublish')
  unpublishCourse(
    @CurrentUser() user: AuthenticatedUser,
    @Param('courseId') courseId: string,
  ) {
    return this.catalogService
      .unpublishCourse(user.role, courseId)
      .then((data) => ok(data));
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(
    UserRole.TEACHER,
    UserRole.CONTENT_CREATOR,
    UserRole.SCHOOL_ADMIN,
    UserRole.SUPER_ADMIN,
  )
  @Post('courses/:courseId/modules')
  createModule(
    @CurrentUser() user: AuthenticatedUser,
    @Param('courseId') courseId: string,
    @Body() body: { title: string; order?: number },
  ) {
    return this.catalogService
      .createModule(user.role, { courseId, ...body })
      .then((data) => ok(data));
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(
    UserRole.TEACHER,
    UserRole.CONTENT_CREATOR,
    UserRole.SCHOOL_ADMIN,
    UserRole.SUPER_ADMIN,
  )
  @Post('modules/:moduleId/lessons')
  createLesson(
    @CurrentUser() user: AuthenticatedUser,
    @Param('moduleId') moduleId: string,
    @Body()
    body: {
      courseId: string;
      title: string;
      blocks?: Array<{ type: 'text' | 'image' | 'audio' | 'video'; content?: string; mediaUrl?: string }>;
      vocabulary?: string[];
      pronunciationNotes?: string[];
      culturalNotes?: string[];
      gamecardQrCode?: string;
      order?: number;
    },
  ) {
    return this.catalogService
      .createLesson(user.role, { moduleId, ...body })
      .then((data) => ok(data));
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(
    UserRole.TEACHER,
    UserRole.CONTENT_CREATOR,
    UserRole.SCHOOL_ADMIN,
    UserRole.SUPER_ADMIN,
  )
  @Patch('lessons/:lessonId/publish')
  publishLesson(
    @CurrentUser() user: AuthenticatedUser,
    @Param('lessonId') lessonId: string,
  ) {
    return this.catalogService
      .publishLesson(user.role, lessonId)
      .then((data) => ok(data));
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(
    UserRole.TEACHER,
    UserRole.CONTENT_CREATOR,
    UserRole.SCHOOL_ADMIN,
    UserRole.SUPER_ADMIN,
  )
  @Post('lessons/:lessonId/activities')
  createActivity(
    @CurrentUser() user: AuthenticatedUser,
    @Param('lessonId') lessonId: string,
    @Body()
    body: { type: ActivityType; payload: Record<string, unknown>; order?: number },
  ) {
    return this.catalogService
      .createActivity(user.role, { lessonId, ...body })
      .then((data) => ok(data));
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(
    UserRole.TEACHER,
    UserRole.CONTENT_CREATOR,
    UserRole.SCHOOL_ADMIN,
    UserRole.SUPER_ADMIN,
  )
  @Post('lessons/:lessonId/quizzes')
  createQuiz(
    @CurrentUser() user: AuthenticatedUser,
    @Param('lessonId') lessonId: string,
    @Body()
    body: {
      title: string;
      questions: Array<Record<string, unknown>>;
      passScorePercent?: number;
      timerSeconds?: number;
      randomizeQuestions?: boolean;
    },
  ) {
    return this.catalogService
      .createQuiz(user.role, {
        lessonId,
        title: body.title,
        questions: body.questions as never,
        passScorePercent: body.passScorePercent,
        timerSeconds: body.timerSeconds,
        randomizeQuestions: body.randomizeQuestions,
      })
      .then((data) => ok(data));
  }
}
