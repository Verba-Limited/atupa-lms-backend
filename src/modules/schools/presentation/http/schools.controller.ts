import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
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
import { Public } from '../../../../shared/presentation/decorators/public.decorator';
import { Roles } from '../../../../shared/presentation/decorators/roles.decorator';
import { pageOf } from '../../../../shared/presentation/dto/pagination-query.dto';
import { ok } from '../../../../shared/presentation/http/api-response';
import { IdParam } from '../../../../shared/presentation/http/id-param';
import { SchoolsService } from '../../application/schools.service';
import {
  AddMemberDto,
  JoinSchoolDto,
  MembersQueryDto,
  RegisterSchoolDto,
  SchoolProfileDto,
  SchoolsQueryDto,
  UpdateSchoolDto,
} from './dto/schools.dto';

@ApiTags('Schools')
@Controller('schools')
export class SchoolsController {
  constructor(private readonly schools: SchoolsService) {}

  /** Public school sign-up: creates the school and its admin account. */
  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('register')
  async register(@Body() dto: RegisterSchoolDto) {
    return ok(await this.schools.register(dto), 'School registered');
  }

  @ApiBearerAuth()
  @Roles(UserRole.SUPER_ADMIN)
  @Post()
  async create(@Body() dto: SchoolProfileDto) {
    return ok(await this.schools.createByAdmin(dto), 'School created');
  }

  @ApiBearerAuth()
  @Roles(UserRole.SUPER_ADMIN)
  @Get()
  async list(@Query() query: SchoolsQueryDto) {
    return ok(
      await this.schools.list(
        { q: query.q, isActive: query.isActive },
        pageOf(query),
      ),
    );
  }

  @ApiBearerAuth()
  @Get('mine')
  async mine(@CurrentUser() actor: Actor) {
    if (!actor.schoolId)
      throw new ForbiddenException('You do not belong to a school');
    return ok(await this.schools.get(actor, actor.schoolId));
  }

  @ApiBearerAuth()
  @Roles(UserRole.LEARNER, UserRole.TEACHER)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @HttpCode(200)
  @Post('join')
  async join(@CurrentUser() actor: Actor, @Body() dto: JoinSchoolDto) {
    return ok(await this.schools.join(actor, dto.joinCode), 'Joined school');
  }

  @ApiBearerAuth()
  @Get(':schoolId')
  async get(
    @CurrentUser() actor: Actor,
    @IdParam('schoolId') schoolId: string,
  ) {
    return ok(await this.schools.get(actor, schoolId));
  }

  @ApiBearerAuth()
  @Roles(UserRole.SCHOOL_ADMIN, UserRole.SUPER_ADMIN)
  @Patch(':schoolId')
  async update(
    @CurrentUser() actor: Actor,
    @IdParam('schoolId') schoolId: string,
    @Body() dto: UpdateSchoolDto,
  ) {
    return ok(
      await this.schools.update(actor, schoolId, dto),
      'School updated',
    );
  }

  @ApiBearerAuth()
  @Roles(UserRole.SCHOOL_ADMIN, UserRole.SUPER_ADMIN)
  @HttpCode(200)
  @Post(':schoolId/join-code/rotate')
  async rotate(
    @CurrentUser() actor: Actor,
    @IdParam('schoolId') schoolId: string,
  ) {
    return ok(
      await this.schools.rotateJoinCode(actor, schoolId),
      'Join code rotated',
    );
  }

  @ApiBearerAuth()
  @Roles(UserRole.SCHOOL_ADMIN, UserRole.SUPER_ADMIN)
  @Get(':schoolId/members')
  async members(
    @CurrentUser() actor: Actor,
    @IdParam('schoolId') schoolId: string,
    @Query() query: MembersQueryDto,
  ) {
    return ok(
      await this.schools.listMembers(
        actor,
        schoolId,
        query.role,
        pageOf(query),
      ),
    );
  }

  /** Add a teacher or student; they receive an email to set their password. */
  @ApiBearerAuth()
  @Roles(UserRole.SCHOOL_ADMIN, UserRole.SUPER_ADMIN)
  @Post(':schoolId/members')
  async addMember(
    @CurrentUser() actor: Actor,
    @IdParam('schoolId') schoolId: string,
    @Body() dto: AddMemberDto,
  ) {
    return ok(
      await this.schools.addMember(actor, schoolId, dto),
      'Member invited',
    );
  }

  @ApiBearerAuth()
  @Roles(UserRole.SCHOOL_ADMIN, UserRole.SUPER_ADMIN)
  @Delete(':schoolId/members/:userId')
  async removeMember(
    @CurrentUser() actor: Actor,
    @IdParam('schoolId') schoolId: string,
    @IdParam('userId') userId: string,
  ) {
    await this.schools.removeMember(actor, schoolId, userId);
    return ok(null, 'Member removed from school');
  }
}
