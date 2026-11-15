import {
  Body,
  Controller,
  Get,
  HttpCode,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Actor } from '../../../../shared/application/actor';
import { SUPPORT_ROLES, UserRole } from '../../../../shared/domain/user-role';
import { CurrentUser } from '../../../../shared/presentation/decorators/current-user.decorator';
import { Roles } from '../../../../shared/presentation/decorators/roles.decorator';
import { pageOf } from '../../../../shared/presentation/dto/pagination-query.dto';
import { ok } from '../../../../shared/presentation/http/api-response';
import { IdParam } from '../../../../shared/presentation/http/id-param';
import { AlertsService } from '../../application/alerts.service';
import { SafetyReportsService } from '../../application/safety-reports.service';
import {
  AlertsQueryDto,
  AssignReportDto,
  FileReportDto,
  ReportCommentDto,
  ReportQueueQueryDto,
  ResolveReportDto,
  UpdateAlertDto,
} from './safety.dto';

/** The "Report" button for learners and parents (and teachers). */
@ApiTags('Safety reports')
@ApiBearerAuth()
@Roles(UserRole.LEARNER, UserRole.PARENT, UserRole.TEACHER)
@Controller('safety-reports')
export class SafetyReportsController {
  constructor(private readonly reports: SafetyReportsService) {}

  /** Returns a reference number; the reported person never learns who sent it. */
  @Throttle({ default: { limit: 10, ttl: 3_600_000 } })
  @Post()
  async file(@CurrentUser() actor: Actor, @Body() dto: FileReportDto) {
    const report = await this.reports.file(actor, dto);
    return ok(
      report,
      `Thank you. Your reference is ${report.reference}. We will let you know when it is handled.`,
    );
  }

  @Get('mine')
  async mine(@CurrentUser() actor: Actor, @Query() query: ReportQueueQueryDto) {
    return ok(await this.reports.listMine(actor, pageOf(query)));
  }
}

/** Reports queue (M-27): most serious first, then oldest. */
@ApiTags('Admin · Safety reports')
@ApiBearerAuth()
@Roles(...SUPPORT_ROLES)
@Controller('admin/safety-reports')
export class AdminSafetyReportsController {
  constructor(private readonly reports: SafetyReportsService) {}

  @Get()
  async queue(@Query() query: ReportQueueQueryDto) {
    const { page, limit, ...filter } = query;
    return ok(await this.reports.queue(filter, pageOf({ page, limit })));
  }

  @Get(':reportId')
  async get(@IdParam('reportId') id: string) {
    return ok(await this.reports.get(id));
  }

  @HttpCode(200)
  @Post(':reportId/assign')
  async assign(@IdParam('reportId') id: string, @Body() dto: AssignReportDto) {
    return ok(await this.reports.assign(id, dto.assigneeId), 'Report assigned');
  }

  @Post(':reportId/comments')
  async comment(
    @CurrentUser() actor: Actor,
    @IdParam('reportId') id: string,
    @Body() dto: ReportCommentDto,
  ) {
    return ok(await this.reports.comment(actor, id, dto.body), 'Comment added');
  }

  /** Closing a report carries out its outcome (warn, hide, suspend, remove). */
  @Roles(UserRole.SUPER_ADMIN)
  @HttpCode(200)
  @Post(':reportId/resolve')
  async resolve(
    @CurrentUser() actor: Actor,
    @IdParam('reportId') id: string,
    @Body() dto: ResolveReportDto,
  ) {
    return ok(
      await this.reports.resolve(actor, id, dto.outcome, dto.note),
      'Report resolved',
    );
  }
}

/** Unusual activity alerts (M-29). */
@ApiTags('Admin · Alerts')
@ApiBearerAuth()
@Roles(...SUPPORT_ROLES)
@Controller('admin/alerts')
export class AdminAlertsController {
  constructor(private readonly alerts: AlertsService) {}

  @Get()
  async list(@Query() query: AlertsQueryDto) {
    const { page, limit, ...filter } = query;
    return ok(await this.alerts.list(filter, pageOf({ page, limit })));
  }

  @Patch(':alertId')
  async update(
    @CurrentUser() actor: Actor,
    @IdParam('alertId') id: string,
    @Body() dto: UpdateAlertDto,
  ) {
    return ok(await this.alerts.update(actor, id, dto), 'Alert updated');
  }
}
