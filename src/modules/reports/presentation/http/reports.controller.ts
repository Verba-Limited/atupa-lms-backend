import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsMongoId, IsOptional, Max, Min } from 'class-validator';
import type { Actor } from '../../../../shared/application/actor';
import { UserRole } from '../../../../shared/domain/user-role';
import { CurrentUser } from '../../../../shared/presentation/decorators/current-user.decorator';
import { Roles } from '../../../../shared/presentation/decorators/roles.decorator';
import { ok } from '../../../../shared/presentation/http/api-response';
import { IdParam } from '../../../../shared/presentation/http/id-param';
import { DashboardsService } from '../../application/dashboards.service';
import type {
  LeaderboardPeriod,
  LeaderboardScope,
} from '../../application/leaderboards.service';
import { LeaderboardsService } from '../../application/leaderboards.service';
import { ReportsService } from '../../application/reports.service';

export class SchoolDashboardQueryDto {
  @ApiPropertyOptional({ description: 'Super admins: any school' })
  @IsOptional()
  @IsMongoId()
  schoolId?: string;
}

export class LeaderboardQueryDto {
  @ApiPropertyOptional({
    enum: ['global', 'school', 'class'],
    default: 'class',
  })
  @IsOptional()
  @IsIn(['global', 'school', 'class'])
  scope: LeaderboardScope = 'class';

  @ApiPropertyOptional({ enum: ['week', 'month', 'all'], default: 'week' })
  @IsOptional()
  @IsIn(['week', 'month', 'all'])
  period: LeaderboardPeriod = 'week';

  @ApiPropertyOptional()
  @IsOptional()
  @IsMongoId()
  classId?: string;

  @ApiPropertyOptional({ default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit: number = 20;
}

@ApiTags('Dashboards')
@ApiBearerAuth()
@Controller('dashboards')
export class DashboardsController {
  constructor(private readonly dashboards: DashboardsService) {}

  @Roles(UserRole.LEARNER)
  @Get('learner')
  async learner(@CurrentUser() actor: Actor) {
    return ok(await this.dashboards.learner(actor));
  }

  @Roles(UserRole.PARENT)
  @Get('parent')
  async parent(@CurrentUser() actor: Actor) {
    return ok(await this.dashboards.parent(actor));
  }

  /** One child's detail: courses, scores, time, badges, certificates, streak, feedback. */
  @Roles(UserRole.PARENT, UserRole.SUPER_ADMIN)
  @Get('children/:childId')
  async child(
    @CurrentUser() actor: Actor,
    @IdParam('childId') childId: string,
  ) {
    return ok(await this.dashboards.child(actor, childId));
  }

  @Roles(UserRole.TEACHER)
  @Get('teacher')
  async teacher(@CurrentUser() actor: Actor) {
    return ok(await this.dashboards.teacher(actor));
  }

  @Roles(UserRole.SCHOOL_ADMIN, UserRole.SUPER_ADMIN)
  @Get('school')
  async school(
    @CurrentUser() actor: Actor,
    @Query() query: SchoolDashboardQueryDto,
  ) {
    return ok(await this.dashboards.school(actor, query.schoolId));
  }

  @Roles(UserRole.SUPER_ADMIN)
  @Get('admin')
  async admin() {
    return ok(await this.dashboards.admin());
  }
}

@ApiTags('Reports')
@ApiBearerAuth()
@Controller()
export class ReportsController {
  constructor(
    private readonly reports: ReportsService,
    private readonly leaderboards: LeaderboardsService,
  ) {}

  /** Learner, linked parents, their teachers, their school admin, super admin. */
  @Get('reports/learners/:learnerId')
  async learner(
    @CurrentUser() actor: Actor,
    @IdParam('learnerId') learnerId: string,
  ) {
    return ok(await this.reports.learner(actor, learnerId));
  }

  @Roles(UserRole.TEACHER, UserRole.SCHOOL_ADMIN, UserRole.SUPER_ADMIN)
  @Get('reports/classes/:classId')
  async classReport(
    @CurrentUser() actor: Actor,
    @IdParam('classId') classId: string,
  ) {
    return ok(await this.reports.classReport(actor, classId));
  }

  @Roles(UserRole.SCHOOL_ADMIN, UserRole.SUPER_ADMIN)
  @Get('reports/schools/:schoolId')
  async schoolReport(
    @CurrentUser() actor: Actor,
    @IdParam('schoolId') schoolId: string,
  ) {
    return ok(await this.reports.schoolReport(actor, schoolId));
  }

  @Get('leaderboards')
  async leaderboard(
    @CurrentUser() actor: Actor,
    @Query() query: LeaderboardQueryDto,
  ) {
    return ok(await this.leaderboards.get(actor, query));
  }
}
