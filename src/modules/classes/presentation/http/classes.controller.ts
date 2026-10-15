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
import { Throttle } from '@nestjs/throttler';
import type { Actor } from '../../../../shared/application/actor';
import { UserRole } from '../../../../shared/domain/user-role';
import { CurrentUser } from '../../../../shared/presentation/decorators/current-user.decorator';
import { Roles } from '../../../../shared/presentation/decorators/roles.decorator';
import { pageOf } from '../../../../shared/presentation/dto/pagination-query.dto';
import { ok } from '../../../../shared/presentation/http/api-response';
import { IdParam } from '../../../../shared/presentation/http/id-param';
import { ClassesService } from '../../application/classes.service';
import {
  AddStudentsDto,
  AnnouncementDto,
  ClassesQueryDto,
  CreateClassDto,
  JoinClassDto,
  SetTeacherDto,
  UpdateClassDto,
} from './dto/classes.dto';

const MANAGERS = [
  UserRole.TEACHER,
  UserRole.SCHOOL_ADMIN,
  UserRole.SUPER_ADMIN,
];

@ApiTags('Classes')
@ApiBearerAuth()
@Controller('classes')
export class ClassesController {
  constructor(private readonly classes: ClassesService) {}

  @Roles(...MANAGERS)
  @Post()
  async create(@CurrentUser() actor: Actor, @Body() dto: CreateClassDto) {
    return ok(await this.classes.create(actor, dto), 'Class created');
  }

  /** Teachers: my classes. School admins: school classes. Learners: classes I'm in. */
  @Get()
  async list(@CurrentUser() actor: Actor, @Query() query: ClassesQueryDto) {
    return ok(
      await this.classes.list(
        actor,
        { schoolId: query.schoolId },
        pageOf(query),
      ),
    );
  }

  @Roles(UserRole.LEARNER)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @HttpCode(200)
  @Post('join')
  async join(@CurrentUser() actor: Actor, @Body() dto: JoinClassDto) {
    return ok(await this.classes.joinWithCode(actor, dto.code), 'Joined class');
  }

  @Get(':classId')
  async get(@CurrentUser() actor: Actor, @IdParam('classId') classId: string) {
    return ok(await this.classes.get(actor, classId));
  }

  @Roles(...MANAGERS)
  @Patch(':classId')
  async update(
    @CurrentUser() actor: Actor,
    @IdParam('classId') classId: string,
    @Body() dto: UpdateClassDto,
  ) {
    return ok(await this.classes.update(actor, classId, dto), 'Class updated');
  }

  @Roles(...MANAGERS)
  @Delete(':classId')
  async archive(
    @CurrentUser() actor: Actor,
    @IdParam('classId') classId: string,
  ) {
    await this.classes.archive(actor, classId);
    return ok(null, 'Class archived');
  }

  @Roles(UserRole.SCHOOL_ADMIN, UserRole.SUPER_ADMIN)
  @Patch(':classId/teacher')
  async setTeacher(
    @CurrentUser() actor: Actor,
    @IdParam('classId') classId: string,
    @Body() dto: SetTeacherDto,
  ) {
    return ok(
      await this.classes.setTeacher(actor, classId, dto.teacherUserId),
      'Teacher assigned',
    );
  }

  @Roles(...MANAGERS)
  @Post(':classId/students')
  async addStudents(
    @CurrentUser() actor: Actor,
    @IdParam('classId') classId: string,
    @Body() dto: AddStudentsDto,
  ) {
    return ok(
      await this.classes.addStudents(actor, classId, dto.studentIds),
      'Students added',
    );
  }

  @Roles(...MANAGERS)
  @Delete(':classId/students/:studentId')
  async removeStudent(
    @CurrentUser() actor: Actor,
    @IdParam('classId') classId: string,
    @IdParam('studentId') studentId: string,
  ) {
    return ok(
      await this.classes.removeStudent(actor, classId, studentId),
      'Student removed',
    );
  }

  @Roles(UserRole.LEARNER)
  @Delete(':classId/membership')
  async leave(
    @CurrentUser() actor: Actor,
    @IdParam('classId') classId: string,
  ) {
    await this.classes.leave(actor, classId);
    return ok(null, 'Left class');
  }

  @Roles(...MANAGERS)
  @Post(':classId/courses/:courseId')
  async assignCourse(
    @CurrentUser() actor: Actor,
    @IdParam('classId') classId: string,
    @IdParam('courseId') courseId: string,
  ) {
    return ok(
      await this.classes.assignCourse(actor, classId, courseId),
      'Course assigned',
    );
  }

  @Roles(...MANAGERS)
  @Delete(':classId/courses/:courseId')
  async unassignCourse(
    @CurrentUser() actor: Actor,
    @IdParam('classId') classId: string,
    @IdParam('courseId') courseId: string,
  ) {
    return ok(
      await this.classes.unassignCourse(actor, classId, courseId),
      'Course removed',
    );
  }

  @Roles(...MANAGERS)
  @HttpCode(200)
  @Post(':classId/join-code/rotate')
  async rotate(
    @CurrentUser() actor: Actor,
    @IdParam('classId') classId: string,
  ) {
    return ok(
      await this.classes.rotateJoinCode(actor, classId),
      'Join code rotated',
    );
  }

  /** Teacher announcement to every student (and their parents). */
  @Roles(...MANAGERS)
  @Post(':classId/announcements')
  async announce(
    @CurrentUser() actor: Actor,
    @IdParam('classId') classId: string,
    @Body() dto: AnnouncementDto,
  ) {
    return ok(
      await this.classes.announce(actor, classId, dto.title, dto.body),
      'Announcement sent',
    );
  }
}
