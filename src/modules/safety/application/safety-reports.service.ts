import { Inject, Injectable } from '@nestjs/common';
import type { Actor } from '../../../shared/application/actor';
import type { EventBus } from '../../../shared/application/event-bus.port';
import { EVENT_BUS } from '../../../shared/application/event-bus.port';
import {
  SafetyReportFiled,
  SafetyReportResolved,
} from '../../../shared/contracts/events';
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from '../../../shared/domain/errors';
import { mapPage, PageRequest } from '../../../shared/domain/pagination';
import { SUPPORT_ROLES, UserRole } from '../../../shared/domain/user-role';
import { CatalogQueryService, ContentReviewService } from '../../catalog';
import { ClassesService } from '../../classes';
import { UsersService } from '../../identity';
import { MediaPurpose, MediaService } from '../../media';
import { SchoolsService } from '../../schools';
import {
  allowedOutcomes,
  newReportReference,
  ReportOutcome,
  ReportReason,
  ReportTargetType,
  responseDeadline,
  SafetyReport,
  severityOf,
} from '../domain/safety-report.entity';
import type {
  ReportFilter,
  SafetyReportRepository,
} from './ports/safety.repositories.port';
import { SAFETY_REPORT_REPOSITORY } from './ports/safety.repositories.port';

interface ResolvedTarget {
  name: string;
  ownerId: string | null;
  schoolId: string | null;
}

/** Learners and parents report problems; ATUPA staff handle them (M-26/27). */
@Injectable()
export class SafetyReportsService {
  constructor(
    @Inject(SAFETY_REPORT_REPOSITORY)
    private readonly reports: SafetyReportRepository,
    @Inject(EVENT_BUS) private readonly events: EventBus,
    private readonly users: UsersService,
    private readonly schools: SchoolsService,
    private readonly catalog: CatalogQueryService,
    private readonly review: ContentReviewService,
    private readonly classes: ClassesService,
    private readonly media: MediaService,
  ) {}

  async file(
    actor: Actor,
    input: {
      targetType: ReportTargetType;
      targetId: string;
      reason: ReportReason;
      note?: string;
      attachmentIds?: string[];
    },
  ) {
    const target = await this.resolveTarget(input.targetType, input.targetId);
    if (target.ownerId === actor.userId) {
      throw new ValidationError('You cannot report yourself');
    }
    const assets = input.attachmentIds?.length
      ? await this.media.requireOwnUploads(
          actor,
          input.attachmentIds,
          MediaPurpose.REPORT,
        )
      : [];
    const severity = severityOf(input.reason);
    const report = await this.reports.create({
      reference: newReportReference(),
      reporterId: actor.userId,
      reporterRole: actor.role,
      targetType: input.targetType,
      targetId: input.targetId,
      targetName: target.name,
      targetOwnerId: target.ownerId,
      targetSchoolId: target.schoolId,
      reason: input.reason,
      note: input.note ?? null,
      attachments: assets.map((a) => ({ mediaId: a.id, url: a.url })),
      severity,
      status: 'open',
      assigneeId: null,
      comments: [],
      outcome: null,
      dueAt: responseDeadline(severity),
    });
    await this.events.publish(
      new SafetyReportFiled(
        report.id,
        report.reference,
        severity,
        report.targetType,
        report.targetId,
        report.targetName,
        report.reason,
      ),
    );
    return toReporterView(report);
  }

  /** The reporter's own reports. Staff notes are never shown here. */
  async listMine(actor: Actor, page: PageRequest) {
    return mapPage(
      await this.reports.listQueue({ reporterId: actor.userId }, page),
      toReporterView,
    );
  }

  async queue(filter: ReportFilter, page: PageRequest) {
    const result = await this.reports.listQueue(filter, page);
    const now = Date.now();
    return mapPage(result, (r) => ({
      ...r,
      overdue: r.status !== 'resolved' && r.dueAt.getTime() < now,
    }));
  }

  countAgainst(userId: string) {
    return this.reports.countAgainstOwner(userId);
  }

  countOpen(filter: ReportFilter = {}) {
    return this.reports.count({ ...filter, unresolved: true });
  }

  async get(reportId: string) {
    const report = await this.require(reportId);
    const people = await this.users.findByIds(
      [
        report.reporterId,
        report.targetOwnerId,
        report.assigneeId,
        ...report.comments.map((c) => c.authorId),
      ].filter((id): id is string => !!id),
    );
    const name = (id?: string | null) => {
      const u = people.find((p) => p.id === id);
      return u ? [u.firstName, u.lastName].filter(Boolean).join(' ') : null;
    };
    return {
      ...report,
      overdue:
        report.status !== 'resolved' && report.dueAt.getTime() < Date.now(),
      reporterName: name(report.reporterId),
      targetOwnerName: name(report.targetOwnerId),
      assigneeName: name(report.assigneeId),
      comments: report.comments.map((c) => ({
        ...c,
        authorName: name(c.authorId),
      })),
      allowedOutcomes: allowedOutcomes(report.targetType),
    };
  }

  async assign(reportId: string, assigneeId: string) {
    const report = await this.requireUnresolved(reportId);
    const assignee = await this.users.findById(assigneeId);
    if (!assignee || !SUPPORT_ROLES.includes(assignee.role)) {
      throw new ValidationError('Assign reports to a super or support admin');
    }
    return this.reports.update(report.id, {
      assigneeId,
      status: 'in_review',
    });
  }

  async comment(actor: Actor, reportId: string, body: string) {
    await this.require(reportId);
    return this.reports.addComment(reportId, {
      authorId: actor.userId,
      body,
      at: new Date(),
    });
  }

  /**
   * Closes a report and carries out the outcome: warn the account owner,
   * hide the course, suspend the account or remove (deactivate) the school.
   */
  async resolve(
    actor: Actor,
    reportId: string,
    outcome: ReportOutcome,
    note?: string,
  ) {
    const report = await this.requireUnresolved(reportId);
    if (!allowedOutcomes(report.targetType).includes(outcome)) {
      throw new ValidationError(
        `"${outcome}" does not apply to a ${report.targetType} report`,
      );
    }
    const reason = note ?? `Safety report ${report.reference}`;
    switch (outcome) {
      case ReportOutcome.HIDE_COURSE:
        await this.review.hideCourse(report.targetId, reason);
        break;
      case ReportOutcome.SUSPEND_ACCOUNT: {
        if (!report.targetOwnerId) {
          throw new ValidationError('There is no account to suspend');
        }
        const owner = await this.users.findById(report.targetOwnerId);
        if (owner && owner.role === UserRole.SUPER_ADMIN) {
          throw new ForbiddenError('Super admin accounts cannot be suspended');
        }
        await this.users.suspend(report.targetOwnerId);
        await this.review.makeAuthorCoursesPrivate(report.targetOwnerId);
        break;
      }
      case ReportOutcome.REMOVE_SCHOOL:
        if (!report.targetSchoolId) {
          throw new ValidationError('This report is not linked to a school');
        }
        await this.schools.suspend(report.targetSchoolId);
        break;
      default:
        break;
    }
    const resolved = (await this.reports.update(report.id, {
      status: 'resolved',
      outcome,
      outcomeNote: note ?? null,
      resolvedAt: new Date(),
      resolvedByUserId: actor.userId,
    })) as SafetyReport;
    await this.events.publish(
      new SafetyReportResolved(
        resolved.id,
        resolved.reference,
        resolved.reporterId,
        outcome,
        outcome === ReportOutcome.WARNING
          ? (resolved.targetOwnerId ?? undefined)
          : undefined,
      ),
    );
    return resolved;
  }

  private async resolveTarget(
    type: ReportTargetType,
    id: string,
  ): Promise<ResolvedTarget> {
    switch (type) {
      case 'teacher': {
        const user = await this.users.findById(id);
        if (!user || user.role !== UserRole.TEACHER) {
          throw new NotFoundError('Teacher not found');
        }
        return {
          name: [user.firstName, user.lastName].filter(Boolean).join(' '),
          ownerId: user.id,
          schoolId: user.schoolId ?? null,
        };
      }
      case 'school': {
        const school = await this.schools.findById(id);
        if (!school) throw new NotFoundError('School not found');
        return {
          name: school.name,
          ownerId: school.adminUserId ?? null,
          schoolId: school.id,
        };
      }
      case 'course': {
        const course = await this.catalog.findCourse(id);
        if (!course) throw new NotFoundError('Course not found');
        return {
          name: course.title,
          ownerId: course.createdByUserId ?? null,
          schoolId: course.schoolId ?? null,
        };
      }
      case 'class': {
        const classroom = await this.classes.findById(id);
        if (!classroom) throw new NotFoundError('Class not found');
        return {
          name: classroom.name,
          ownerId: classroom.teacherUserId,
          schoolId: classroom.schoolId,
        };
      }
    }
  }

  private async require(reportId: string): Promise<SafetyReport> {
    const report = await this.reports.findById(reportId);
    if (!report) throw new NotFoundError('Report not found');
    return report;
  }

  private async requireUnresolved(reportId: string): Promise<SafetyReport> {
    const report = await this.require(reportId);
    if (report.status === 'resolved') {
      throw new ConflictError('This report has already been resolved');
    }
    return report;
  }
}

/** What the person who filed the report may see. */
function toReporterView(report: SafetyReport) {
  return {
    id: report.id,
    reference: report.reference,
    targetType: report.targetType,
    targetName: report.targetName,
    reason: report.reason,
    status: report.status,
    handled: report.status === 'resolved',
    createdAt: report.createdAt,
    resolvedAt: report.resolvedAt ?? null,
  };
}
