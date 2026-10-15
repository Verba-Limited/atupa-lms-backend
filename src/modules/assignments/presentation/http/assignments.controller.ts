import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { Actor } from '../../../../shared/application/actor';
import { UserRole } from '../../../../shared/domain/user-role';
import { CurrentUser } from '../../../../shared/presentation/decorators/current-user.decorator';
import { Roles } from '../../../../shared/presentation/decorators/roles.decorator';
import {
  pageOf,
  PaginationQueryDto,
} from '../../../../shared/presentation/dto/pagination-query.dto';
import { ok } from '../../../../shared/presentation/http/api-response';
import { IdParam } from '../../../../shared/presentation/http/id-param';
import { AssignmentsService } from '../../application/assignments.service';
import {
  CreateAssignmentDto,
  ReviewDto,
  SubmitWorkDto,
} from './dto/assignments.dto';

const MANAGERS = [
  UserRole.TEACHER,
  UserRole.SCHOOL_ADMIN,
  UserRole.SUPER_ADMIN,
];

@ApiTags('Assignments')
@ApiBearerAuth()
@Controller('assignments')
export class AssignmentsController {
  constructor(private readonly assignments: AssignmentsService) {}

  @Roles(...MANAGERS)
  @Post()
  async create(@CurrentUser() actor: Actor, @Body() dto: CreateAssignmentDto) {
    return ok(await this.assignments.create(actor, dto), 'Assignment created');
  }

  @Roles(UserRole.LEARNER)
  @Get('mine')
  async mine(@CurrentUser() actor: Actor, @Query() query: PaginationQueryDto) {
    return ok(await this.assignments.listMine(actor, pageOf(query)));
  }

  @Get('classes/:classroomId')
  async forClass(
    @CurrentUser() actor: Actor,
    @IdParam('classroomId') classroomId: string,
    @Query() query: PaginationQueryDto,
  ) {
    return ok(
      await this.assignments.listForClass(actor, classroomId, pageOf(query)),
    );
  }

  @Get(':assignmentId')
  async get(@CurrentUser() actor: Actor, @IdParam('assignmentId') id: string) {
    return ok(await this.assignments.get(actor, id));
  }

  @Roles(UserRole.LEARNER)
  @HttpCode(200)
  @Post(':assignmentId/start')
  async start(
    @CurrentUser() actor: Actor,
    @IdParam('assignmentId') id: string,
  ) {
    return ok(await this.assignments.start(actor, id), 'Assignment started');
  }

  @Roles(UserRole.LEARNER)
  @HttpCode(200)
  @Post(':assignmentId/submit')
  async submit(
    @CurrentUser() actor: Actor,
    @IdParam('assignmentId') id: string,
    @Body() dto: SubmitWorkDto,
  ) {
    return ok(
      await this.assignments.submit(actor, id, dto),
      'Assignment submitted',
    );
  }

  @Roles(...MANAGERS)
  @HttpCode(200)
  @Post(':assignmentId/submissions/:learnerId/review')
  async review(
    @CurrentUser() actor: Actor,
    @IdParam('assignmentId') id: string,
    @IdParam('learnerId') learnerId: string,
    @Body() dto: ReviewDto,
  ) {
    return ok(
      await this.assignments.review(actor, id, learnerId, dto),
      'Review saved',
    );
  }

  @Roles(...MANAGERS)
  @Delete(':assignmentId')
  async remove(
    @CurrentUser() actor: Actor,
    @IdParam('assignmentId') id: string,
  ) {
    await this.assignments.remove(actor, id);
    return ok(null, 'Assignment deleted');
  }
}
