import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { AssignmentStatus } from '../../common/enums/assignment-status.enum';
import { UserRole } from '../../common/enums/user-role.enum';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import type { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { ok } from '../../common/utils/api-response';
import { AssignmentsService } from './assignments.service';

@ApiTags('Assignments')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('assignments')
export class AssignmentsController {
  constructor(private readonly assignmentsService: AssignmentsService) {}

  @Roles(UserRole.TEACHER, UserRole.SCHOOL_ADMIN, UserRole.SUPER_ADMIN)
  @Post()
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body()
    body: {
      classroomId: string;
      title: string;
      type: string;
      targetId?: string;
      learnerIds: string[];
    },
  ) {
    return this.assignmentsService
      .create({
        classroomId: body.classroomId,
        teacherUserId: user.userId,
        title: body.title,
        type: body.type as never,
        targetId: body.targetId,
        learnerIds: body.learnerIds,
      })
      .then((data) => ok(data));
  }

  @Roles(UserRole.LEARNER, UserRole.TEACHER)
  @Patch(':assignmentId/status')
  updateStatus(
    @CurrentUser() user: AuthenticatedUser,
    @Param('assignmentId') assignmentId: string,
    @Body()
    body: {
      learnerId?: string;
      status: AssignmentStatus;
      submission?: Record<string, unknown>;
    },
  ) {
    const learnerId = body.learnerId ?? user.userId;
    return this.assignmentsService
      .updateStatus(assignmentId, learnerId, body.status, body.submission)
      .then((data) => ok(data));
  }

  @Get('classroom/:classroomId')
  list(@Param('classroomId') classroomId: string) {
    return this.assignmentsService
      .listForClassroom(classroomId)
      .then((data) => ok(data));
  }
}
