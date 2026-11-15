import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  Res,
  StreamableFile,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { memoryStorage } from 'multer';
import type { Actor } from '../../../../shared/application/actor';
import {
  STAFF_ROLES,
  SUPPORT_ROLES,
  UserRole,
} from '../../../../shared/domain/user-role';
import { CurrentUser } from '../../../../shared/presentation/decorators/current-user.decorator';
import { Roles } from '../../../../shared/presentation/decorators/roles.decorator';
import { pageOf } from '../../../../shared/presentation/dto/pagination-query.dto';
import { ok } from '../../../../shared/presentation/http/api-response';
import { IdParam } from '../../../../shared/presentation/http/id-param';
import { ContentReviewService } from '../../../catalog';
import {
  AdminCourseQueryDto,
  AdminSetVisibilityDto,
  ReviewDecisionDto,
} from '../../../catalog/presentation/http/dto/catalog.dto';
import { SubscriptionsService } from '../../../subscriptions';
import {
  CancelSubscriptionDto,
  GrantSubscriptionDto,
  PaymentsQueryDto,
  PlanDto,
  SubscriptionsQueryDto,
  UpdatePlanDto,
} from '../../../subscriptions/presentation/http/dto/subscriptions.dto';
import { AdminOverviewService } from '../../application/admin-overview.service';
import {
  AdminReviewService,
  LibraryKind,
} from '../../application/admin-review.service';
import {
  BULK_COLUMNS,
  BulkLearnersService,
} from '../../application/bulk-learners.service';
import { ExportsService, FileExport } from '../../application/exports.service';
import { menuFor, permissionsFor } from '../../domain/admin-permissions';
import {
  ActivityExportQueryDto,
  BulkLearnersDto,
  PaymentsExportQueryDto,
  ReportFormatDto,
  UsersExportQueryDto,
  VerificationsQueryDto,
} from './admin.dto';

const LIBRARY_KINDS: Record<string, LibraryKind> = {
  vocabulary: 'vocabulary',
  'cultural-topics': 'cultural_topic',
  games: 'game',
};

function send(res: Response, file: FileExport): StreamableFile {
  res.set({
    'Content-Type': file.contentType,
    'Content-Disposition': `attachment; filename="${file.filename}"`,
  });
  return new StreamableFile(
    typeof file.body === 'string' ? Buffer.from(file.body, 'utf8') : file.body,
  );
}

/** Admin home, permissions, user detail, verifications and bulk upload. */
@ApiTags('Admin · Console')
@ApiBearerAuth()
@Controller('admin')
export class AdminController {
  constructor(
    private readonly overview: AdminOverviewService,
    private readonly bulk: BulkLearnersService,
  ) {}

  /** Role-based menu (M-02): what this admin may see and do. */
  @Roles(...STAFF_ROLES, UserRole.SCHOOL_ADMIN)
  @Get('me/permissions')
  permissions(@CurrentUser() actor: Actor) {
    return ok({
      role: actor.role,
      permissions: permissionsFor(actor.role),
      menu: menuFor(actor.role),
    });
  }

  /** Admin home (M-01): platform numbers and what needs attention. */
  @Roles(UserRole.SUPER_ADMIN)
  @Get('overview')
  async home() {
    return ok(await this.overview.overview());
  }

  /** M-04: profile, role, school, plan, courses, progress and last login. */
  @Roles(...SUPPORT_ROLES)
  @Get('users/:userId/overview')
  async userOverview(@IdParam('userId') userId: string) {
    return ok(await this.overview.userOverview(userId));
  }

  /** Teachers and schools waiting for verification (M-08 / M-28). */
  @Roles(UserRole.SUPER_ADMIN)
  @Get('verifications')
  async verifications(@Query() query: VerificationsQueryDto) {
    return ok(
      await this.overview.verifications(
        query.type,
        query.status,
        pageOf(query),
      ),
    );
  }

  /** CSV template for bulk upload. */
  @Roles(...SUPPORT_ROLES)
  @Get('learners/bulk/template')
  template(@Res({ passthrough: true }) res: Response) {
    return send(res, {
      filename: 'learners-template.csv',
      contentType: 'text/csv; charset=utf-8',
      body: `${BULK_COLUMNS.join(',')}\r\nAda,Obi,ada.obi@example.com,2014-05-20,yoruba\r\n`,
    });
  }

  /**
   * M-11: upload a CSV (field "file", or text in "csv"). With dryRun=true (default) nothing is
   * saved and every row's problems are listed. Send again with dryRun=false
   * to create the learners; they get an email to set their password.
   */
  @Roles(...SUPPORT_ROLES)
  @Post('learners/bulk')
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
        csv: { type: 'string', description: 'Or paste the CSV as text' },
        dryRun: { type: 'boolean', default: true },
        classId: { type: 'string' },
      },
    },
  })
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 1024 * 1024 },
    }),
  )
  async bulkLearners(
    @CurrentUser() actor: Actor,
    @Body() dto: BulkLearnersDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    const csv = file?.buffer.toString('utf8') ?? dto.csv;
    if (!csv) {
      throw new BadRequestException(
        'Attach a CSV file as "file" or send the rows as "csv"',
      );
    }
    const result = await this.bulk.run(actor, csv, {
      dryRun: dto.dryRun,
      classId: dto.classId,
    });
    return ok(
      result,
      result.saved
        ? `${result.created} learners added. They will receive an email to set their password.`
        : result.failed
          ? `${result.failed} of ${result.total} rows need fixing. Nothing was saved.`
          : `All ${result.total} rows look good. Send again with dryRun=false to save.`,
    );
  }
}

/** Content across all authors, the review queue and visibility overrides. */
@ApiTags('Admin · Content')
@ApiBearerAuth()
@Controller('admin')
export class AdminContentController {
  constructor(
    private readonly content: ContentReviewService,
    private readonly reviews: AdminReviewService,
  ) {}

  @Roles(...STAFF_ROLES)
  @Get('courses')
  async courses(@Query() query: AdminCourseQueryDto) {
    const { page, limit, ...filter } = query;
    return ok(await this.content.listCourses(filter, pageOf({ page, limit })));
  }

  /** e.g. switch a teacher's course back to Private; the teacher is told why. */
  @Roles(UserRole.SUPER_ADMIN)
  @HttpCode(200)
  @Patch('courses/:courseId/visibility')
  async setVisibility(
    @IdParam('courseId') courseId: string,
    @Body() dto: AdminSetVisibilityDto,
  ) {
    return ok(
      await this.content.setVisibility(courseId, dto.visibility, dto.reason),
      'Visibility updated',
    );
  }

  @Roles(UserRole.SUPER_ADMIN)
  @Get('reviews')
  async queue() {
    return ok(await this.reviews.queue());
  }

  @Roles(UserRole.SUPER_ADMIN)
  @HttpCode(200)
  @Post('reviews/courses/:courseId')
  async decideCourse(
    @CurrentUser() actor: Actor,
    @IdParam('courseId') id: string,
    @Body() dto: ReviewDecisionDto,
  ) {
    const approve = dto.decision === 'approve';
    return ok(
      await this.reviews.decideCourse(actor, id, approve, dto.comment),
      approve
        ? 'Course approved and published'
        : 'Course sent back to the author',
    );
  }

  @Roles(UserRole.SUPER_ADMIN)
  @HttpCode(200)
  @Post('reviews/lessons/:lessonId')
  async decideLesson(
    @CurrentUser() actor: Actor,
    @IdParam('lessonId') id: string,
    @Body() dto: ReviewDecisionDto,
  ) {
    const approve = dto.decision === 'approve';
    return ok(
      await this.reviews.decideLesson(actor, id, approve, dto.comment),
      approve
        ? 'Lesson approved and published'
        : 'Lesson sent back to the author',
    );
  }

  /** A teacher's request to make a course Public (M-25). */
  @Roles(UserRole.SUPER_ADMIN)
  @HttpCode(200)
  @Post('reviews/courses/:courseId/visibility')
  async decidePublic(
    @CurrentUser() actor: Actor,
    @IdParam('courseId') id: string,
    @Body() dto: ReviewDecisionDto,
  ) {
    const approve = dto.decision === 'approve';
    return ok(
      await this.reviews.decidePublic(actor, id, approve, dto.comment),
      approve ? 'Course is now Public' : 'Request declined',
    );
  }

  /** kind: vocabulary | cultural-topics | games */
  @Roles(UserRole.SUPER_ADMIN)
  @HttpCode(200)
  @Post('reviews/library/:kind/:id')
  async decideLibrary(
    @Param('kind') kind: string,
    @IdParam('id') id: string,
    @Body() dto: ReviewDecisionDto,
  ) {
    const libraryKind = LIBRARY_KINDS[kind];
    if (!libraryKind) {
      throw new BadRequestException(
        'kind must be vocabulary, cultural-topics or games',
      );
    }
    const approve = dto.decision === 'approve';
    return ok(
      await this.reviews.decideLibrary(libraryKind, id, approve),
      approve ? 'Approved and published' : 'Sent back to draft',
    );
  }
}

/** Plans and pricing (S-01), subscriptions (M-21) and payments (M-20). */
@ApiTags('Admin · Billing')
@ApiBearerAuth()
@Roles(UserRole.SUPER_ADMIN)
@Controller('admin')
export class AdminBillingController {
  constructor(private readonly subscriptions: SubscriptionsService) {}

  @Get('plans')
  async plans() {
    return ok(await this.subscriptions.listAllPlans());
  }

  @Post('plans')
  async createPlan(@Body() dto: PlanDto) {
    return ok(await this.subscriptions.createPlan(dto), 'Plan created');
  }

  /** Price changes apply to new payments only. */
  @Patch('plans/:code')
  async updatePlan(@Param('code') code: string, @Body() dto: UpdatePlanDto) {
    const { code: ignored, ...patch } = dto;
    void ignored;
    return ok(await this.subscriptions.updatePlan(code, patch), 'Plan updated');
  }

  @Get('subscriptions')
  async subscriptionsList(@Query() query: SubscriptionsQueryDto) {
    const { page, limit, ...filter } = query;
    return ok(
      await this.subscriptions.listSubscriptions(
        filter,
        pageOf({ page, limit }),
      ),
    );
  }

  /** Give or extend a plan by hand (max 366 days at a time). */
  @HttpCode(200)
  @Post('subscriptions/grant')
  async grant(@CurrentUser() actor: Actor, @Body() dto: GrantSubscriptionDto) {
    return ok(
      await this.subscriptions.grantManually(actor, dto),
      'Plan granted',
    );
  }

  @HttpCode(200)
  @Post('subscriptions/cancel')
  async cancel(
    @CurrentUser() actor: Actor,
    @Body() dto: CancelSubscriptionDto,
  ) {
    return ok(
      await this.subscriptions.cancelManually(actor, dto),
      'Subscription cancelled',
    );
  }

  /** Every payment with user, plan, amount, status and Paystack reference. */
  @Get('payments')
  async payments(@Query() query: PaymentsQueryDto) {
    const { page, limit, ...filter } = query;
    return ok(
      await this.subscriptions.listPayments(filter, pageOf({ page, limit })),
    );
  }
}

/** Downloads (M-23): CSV for any list, PDF for class and school reports. */
@ApiTags('Admin · Exports')
@ApiBearerAuth()
@Controller('admin/exports')
export class AdminExportsController {
  constructor(private readonly exports: ExportsService) {}

  @Roles(...SUPPORT_ROLES)
  @Get('users.csv')
  async users(
    @Query() query: UsersExportQueryDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    return send(res, await this.exports.usersCsv(query));
  }

  @Roles(UserRole.SUPER_ADMIN)
  @Get('payments.csv')
  async payments(
    @Query() query: PaymentsExportQueryDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    return send(res, await this.exports.paymentsCsv(query));
  }

  @Roles(UserRole.SUPER_ADMIN)
  @Get('subscriptions.csv')
  async subscriptions(@Res({ passthrough: true }) res: Response) {
    return send(res, await this.exports.subscriptionsCsv());
  }

  @Roles(UserRole.SUPER_ADMIN)
  @Get('activity-log.csv')
  async activityLog(
    @Query() query: ActivityExportQueryDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    return send(res, await this.exports.activityLogCsv(query));
  }

  @Roles(...SUPPORT_ROLES)
  @Get('safety-reports.csv')
  async safetyReports(@Res({ passthrough: true }) res: Response) {
    return send(res, await this.exports.safetyReportsCsv());
  }

  /** Learners report for a class: ?format=csv (default) or pdf. */
  @Roles(...SUPPORT_ROLES, UserRole.SCHOOL_ADMIN, UserRole.TEACHER)
  @Get('classes/:classId/report')
  async classReport(
    @CurrentUser() actor: Actor,
    @IdParam('classId') classId: string,
    @Query() query: ReportFormatDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    return send(
      res,
      await this.exports.classReport(actor, classId, query.format),
    );
  }

  /** School report for meetings: ?format=pdf or csv. */
  @Roles(UserRole.SUPER_ADMIN, UserRole.SCHOOL_ADMIN)
  @Get('schools/:schoolId/report')
  async schoolReport(
    @CurrentUser() actor: Actor,
    @IdParam('schoolId') schoolId: string,
    @Query() query: ReportFormatDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    return send(
      res,
      await this.exports.schoolReport(actor, schoolId, query.format),
    );
  }
}
