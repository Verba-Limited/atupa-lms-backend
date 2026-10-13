import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../common/enums/user-role.enum';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import type { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { ok } from '../../common/utils/api-response';
import { ClassesService } from './classes.service';

@ApiTags('Classes')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('classes')
export class ClassesController {
  constructor(private readonly classesService: ClassesService) {}

  @Roles(UserRole.TEACHER, UserRole.SCHOOL_ADMIN, UserRole.SUPER_ADMIN)
  @Post()
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: { schoolId: string; name: string; teacherUserId?: string },
  ) {
    return this.classesService
      .createClass({
        schoolId: body.schoolId,
        name: body.name,
        teacherUserId: body.teacherUserId ?? user.userId,
      })
      .then((data) => ok(data));
  }

  @Roles(UserRole.TEACHER, UserRole.SCHOOL_ADMIN, UserRole.SUPER_ADMIN)
  @Patch(':classId/students/:studentId')
  addStudent(
    @CurrentUser() user: AuthenticatedUser,
    @Param('classId') classId: string,
    @Param('studentId') studentId: string,
  ) {
    return this.classesService
      .addStudent(classId, studentId, user.schoolId)
      .then((data) => ok(data));
  }

  @Roles(UserRole.TEACHER, UserRole.SCHOOL_ADMIN, UserRole.SUPER_ADMIN)
  @Patch(':classId/courses/:courseId')
  assignCourse(
    @CurrentUser() user: AuthenticatedUser,
    @Param('classId') classId: string,
    @Param('courseId') courseId: string,
  ) {
    return this.classesService
      .assignCourse(classId, courseId, user.userId, user.role)
      .then((data) => ok(data));
  }

  @Roles(UserRole.TEACHER)
  @Get('mine')
  mine(@CurrentUser() user: AuthenticatedUser) {
    return this.classesService
      .listForTeacher(user.userId)
      .then((data) => ok(data));
  }
}
