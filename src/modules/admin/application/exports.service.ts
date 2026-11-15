import { Injectable } from '@nestjs/common';
import type { Actor } from '../../../shared/application/actor';
import { Page, PageRequest } from '../../../shared/domain/pagination';
import { displayName } from '../../../shared/domain/text';
import { AuditService } from '../../audit';
import { UsersService } from '../../identity';
import type { UserRole } from '../../../shared/domain/user-role';
import { ReportsService } from '../../reports';
import { SafetyReportsService } from '../../safety';
import { SubscriptionsService } from '../../subscriptions';
import { toCsv } from '../domain/csv';
import { renderPdfReport } from './pdf-report';

const BATCH = 200;
const MAX_EXPORT_ROWS = 20_000;

export interface FileExport {
  filename: string;
  contentType: string;
  body: string | Buffer;
}

function stamp(): string {
  return new Date().toISOString().slice(0, 10);
}

function csvFile(name: string, body: string): FileExport {
  return {
    filename: `${name}-${stamp()}.csv`,
    contentType: 'text/csv; charset=utf-8',
    body,
  };
}

/** Pages through a list endpoint until done (capped for safety). */
async function collect<T>(
  fetch: (page: PageRequest) => Promise<Page<T>>,
): Promise<T[]> {
  const out: T[] = [];
  for (let page = 1; out.length < MAX_EXPORT_ROWS; page++) {
    const result = await fetch({ page, limit: BATCH });
    out.push(...result.items);
    if (result.items.length < BATCH) break;
  }
  return out.slice(0, MAX_EXPORT_ROWS);
}

/**
 * Report and list downloads (M-23). Every export goes through the same
 * access rules as the screen it comes from.
 */
@Injectable()
export class ExportsService {
  constructor(
    private readonly users: UsersService,
    private readonly subscriptions: SubscriptionsService,
    private readonly reports: ReportsService,
    private readonly safety: SafetyReportsService,
    private readonly audit: AuditService,
  ) {}

  async usersCsv(filter: {
    role?: UserRole;
    isActive?: boolean;
    q?: string;
  }): Promise<FileExport> {
    const users = await collect((page) => this.users.list(filter, page));
    return csvFile(
      'users',
      toCsv(
        [
          { key: 'id', label: 'User ID' },
          { key: 'name', label: 'Name' },
          { key: 'email', label: 'Email' },
          { key: 'role', label: 'Role' },
          { key: 'isActive', label: 'Active' },
          { key: 'verificationStatus', label: 'Verification' },
          { key: 'schoolId', label: 'School ID' },
          { key: 'lastLoginAt', label: 'Last login' },
          { key: 'createdAt', label: 'Joined' },
        ],
        users.map((u) => ({ ...u, name: displayName(u) })),
      ),
    );
  }

  async paymentsCsv(filter: {
    status?: 'pending' | 'success' | 'failed';
    from?: Date;
    to?: Date;
  }): Promise<FileExport> {
    const payments = await collect((page) =>
      this.subscriptions.listPayments(filter, page),
    );
    return csvFile(
      'payments',
      toCsv(
        [
          { key: 'reference', label: 'Paystack reference' },
          { key: 'createdAt', label: 'Started' },
          { key: 'paidAt', label: 'Paid' },
          { key: 'status', label: 'Status' },
          { key: 'planCode', label: 'Plan' },
          { key: 'amountNaira', label: 'Amount (NGN)' },
          { key: 'ownerType', label: 'Paid for' },
          { key: 'ownerId', label: 'Owner ID' },
          { key: 'initiatedByUserId', label: 'Paid by user ID' },
          { key: 'failureReason', label: 'Failure reason' },
        ],
        payments.map((p) => ({ ...p, amountNaira: p.amountKobo / 100 })),
      ),
    );
  }

  async subscriptionsCsv(): Promise<FileExport> {
    const subs = await collect((page) =>
      this.subscriptions.listSubscriptions({}, page),
    );
    return csvFile(
      'subscriptions',
      toCsv(
        [
          { key: 'ownerType', label: 'Owner type' },
          { key: 'ownerId', label: 'Owner ID' },
          { key: 'planCode', label: 'Plan' },
          { key: 'status', label: 'Status' },
          { key: 'currentPeriodStart', label: 'Period start' },
          { key: 'currentPeriodEnd', label: 'Period end' },
          { key: 'manualChange', label: 'Last manual change' },
        ],
        subs.map((s) => ({
          ...s,
          manualChange: s.lastManualChange
            ? `${s.lastManualChange.action}: ${s.lastManualChange.reason}`
            : '',
        })),
      ),
    );
  }

  async activityLogCsv(filter: {
    from?: Date;
    to?: Date;
    actorId?: string;
  }): Promise<FileExport> {
    const entries = await collect((page) => this.audit.list(filter, page));
    return csvFile(
      'activity-log',
      toCsv(
        [
          { key: 'createdAt', label: 'When' },
          { key: 'actorEmail', label: 'Who' },
          { key: 'actorRole', label: 'Role' },
          { key: 'action', label: 'Action' },
          { key: 'path', label: 'Endpoint' },
          { key: 'targetId', label: 'Record ID' },
          { key: 'ip', label: 'IP' },
        ],
        entries as unknown as Array<Record<string, unknown>>,
      ),
    );
  }

  async safetyReportsCsv(): Promise<FileExport> {
    const reports = await collect((page) => this.safety.queue({}, page));
    return csvFile(
      'safety-reports',
      toCsv(
        [
          { key: 'reference', label: 'Reference' },
          { key: 'createdAt', label: 'Filed' },
          { key: 'severity', label: 'Severity' },
          { key: 'reason', label: 'Reason' },
          { key: 'targetType', label: 'Target type' },
          { key: 'targetName', label: 'Target' },
          { key: 'status', label: 'Status' },
          { key: 'overdue', label: 'Overdue' },
          { key: 'outcome', label: 'Outcome' },
          { key: 'resolvedAt', label: 'Resolved' },
        ],
        reports,
      ),
    );
  }

  async classReport(
    actor: Actor,
    classId: string,
    format: 'csv' | 'pdf',
  ): Promise<FileExport> {
    const report = await this.reports.classReport(actor, classId);
    const slug = `class-report-${slugify(report.class.name)}`;
    if (format === 'csv') {
      const courseIds = report.courses.map((c) => c.courseId);
      return csvFile(
        slug,
        toCsv(
          [
            { key: 'name', label: 'Learner' },
            { key: 'lessonsCompleted', label: 'Lessons completed' },
            { key: 'averageQuizScorePercent', label: 'Average quiz score (%)' },
            { key: 'learningMinutes', label: 'Learning time (min)' },
            { key: 'points', label: 'Points' },
            { key: 'streakDays', label: 'Streak (days)' },
            ...report.courses.map((c) => ({
              key: `course:${c.courseId}`,
              label: `${c.title} (%)`,
            })),
          ],
          report.learners.map((l) => ({
            ...l,
            ...Object.fromEntries(
              courseIds.map((id) => [
                `course:${id}`,
                l.courses.find((c) => c.courseId === id)?.percent ?? 0,
              ]),
            ),
          })),
        ),
      );
    }
    return {
      filename: `${slug}-${stamp()}.pdf`,
      contentType: 'application/pdf',
      body: await renderPdfReport({
        title: `Class report: ${report.class.name}`,
        subtitle: `${report.class.studentCount} learners`,
        sections: [
          {
            heading: 'Courses',
            table: {
              columns: ['Course', 'Average progress', 'Completed'],
              rows: report.courses.map((c) => [
                c.title,
                `${c.averagePercent}%`,
                c.completed,
              ]),
            },
            empty: 'No courses assigned to this class yet.',
          },
          {
            heading: 'Learners',
            table: {
              columns: [
                'Learner',
                'Lessons',
                'Avg quiz %',
                'Minutes',
                'Streak',
              ],
              rows: report.learners.map((l) => [
                l.name,
                l.lessonsCompleted,
                l.averageQuizScorePercent,
                l.learningMinutes,
                l.streakDays,
              ]),
            },
            empty: 'No learners in this class yet.',
          },
        ],
      }),
    };
  }

  async schoolReport(
    actor: Actor,
    schoolId: string,
    format: 'csv' | 'pdf',
  ): Promise<FileExport> {
    const report = await this.reports.schoolReport(actor, schoolId);
    const slug = `school-report-${slugify(report.school.name)}`;
    if (format === 'csv') {
      return csvFile(
        slug,
        toCsv(
          [
            { key: 'title', label: 'Course' },
            { key: 'enrolled', label: 'Enrolled' },
            { key: 'completed', label: 'Completed' },
            { key: 'completionRate', label: 'Completion rate (%)' },
          ],
          report.courseCompletion,
        ),
      );
    }
    const e = report.studentEngagement;
    return {
      filename: `${slug}-${stamp()}.pdf`,
      contentType: 'application/pdf',
      body: await renderPdfReport({
        title: `School report: ${report.school.name}`,
        sections: [
          {
            heading: 'Learner engagement',
            facts: [
              ['Learners', e.students],
              ['Active in the last 7 days', e.active7d],
              ['Active in the last 30 days', e.active30d],
              ['Engagement rate (7 days)', `${e.engagementRate7d}%`],
              [
                'Average quiz score',
                `${Math.round(report.averagePerformance.average)}% over ${report.averagePerformance.count} quizzes`,
              ],
            ],
          },
          {
            heading: 'Course completion',
            table: {
              columns: ['Course', 'Enrolled', 'Completed', 'Rate'],
              rows: report.courseCompletion.map((c) => [
                c.title ?? c.courseId,
                c.enrolled,
                c.completed,
                `${c.completionRate}%`,
              ]),
            },
          },
          {
            heading: 'Teacher activity',
            table: {
              columns: ['Teacher', 'Classes', 'Learners', 'Assignments'],
              rows: report.teacherActivity.map((t) => [
                t.name,
                t.classes,
                t.students,
                t.assignmentsCreated,
              ]),
            },
          },
        ],
      }),
    };
  }
}

function slugify(text: string): string {
  return (
    text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 40) || 'report'
  );
}
