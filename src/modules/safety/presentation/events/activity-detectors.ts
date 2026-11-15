import { Inject, Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import {
  CourseVisibilityRequested,
  LearnerFacingTextSaved,
  LearnersJoinedClass,
  LoginFailed,
  PaymentFailed,
  SafetyReportFiled,
  UserRegistered,
} from '../../../../shared/contracts/events';
import { UserRole } from '../../../../shared/domain/user-role';
import { ContentReviewService, CourseVisibility } from '../../../catalog';
import { ClassesService } from '../../../classes';
import { UsersService } from '../../../identity';
import { SubscriptionsService } from '../../../subscriptions';
import { AlertsService } from '../../application/alerts.service';
import type {
  SafetyReportRepository,
  SignalRepository,
} from '../../application/ports/safety.repositories.port';
import {
  SAFETY_REPORT_REPOSITORY,
  SIGNAL_REPOSITORY,
} from '../../application/ports/safety.repositories.port';
import { ALERT_RULES, AlertType } from '../../domain/alert.entity';
import { findSuspiciousText } from '../../domain/suspicious-text';

const OPTS = { promisify: true } as const;
const MINUTE = 60_000;

/**
 * Watches platform events for the warning signs in the PRD (M-29) and raises
 * alerts. Detection never blocks or fails the action that triggered it.
 */
@Injectable()
export class ActivityDetectors {
  private readonly logger = new Logger(ActivityDetectors.name);

  constructor(
    private readonly alerts: AlertsService,
    @Inject(SIGNAL_REPOSITORY) private readonly signals: SignalRepository,
    @Inject(SAFETY_REPORT_REPOSITORY)
    private readonly reports: SafetyReportRepository,
    private readonly users: UsersService,
    private readonly classes: ClassesService,
    private readonly review: ContentReviewService,
    private readonly subscriptions: SubscriptionsService,
  ) {}

  /** Many new accounts from one network in a short time. */
  @OnEvent(UserRegistered.NAME, OPTS)
  async onRegistered(event: UserRegistered) {
    await this.safely('signups', () =>
      this.checkNetwork('signup', event.ip, event.userId, 'registered'),
    );
  }

  @OnEvent(LearnersJoinedClass.NAME, OPTS)
  async onLearnersJoined(event: LearnersJoinedClass) {
    await this.safely('class joins', async () => {
      for (const learnerId of event.learnerIds) {
        await this.checkNetwork(
          'class_join',
          event.ip,
          learnerId,
          'joined a class',
        );
      }
      await this.checkNewTeacherLearners(event.teacherUserId);
    });
  }

  /** A brand-new teacher asking to make several courses Public. */
  @OnEvent(CourseVisibilityRequested.NAME, OPTS)
  async onPublicRequested(event: CourseVisibilityRequested) {
    await this.safely('public requests', async () => {
      if (!(await this.isNewAccount(event.authorUserId))) return;
      const [pending, live] = await Promise.all([
        this.review.listCourses(
          { createdByUserId: event.authorUserId, publicRequestPending: true },
          { page: 1, limit: 1 },
        ),
        this.review.listCourses(
          {
            createdByUserId: event.authorUserId,
            visibility: CourseVisibility.PUBLIC,
          },
          { page: 1, limit: 1 },
        ),
      ]);
      const total = pending.total + live.total;
      if (total < ALERT_RULES.newTeacherPublicCourses) return;
      await this.alerts.raise({
        type: AlertType.NEW_TEACHER_PUBLIC_COURSES,
        severity: 'high',
        subjectType: 'user',
        subjectId: event.authorUserId,
        summary: `A teacher who joined in the last ${ALERT_RULES.newAccountDays} days wants ${total} courses Public`,
        details: { courses: total, latestCourseId: event.courseId },
        dedupeKey: `${AlertType.NEW_TEACHER_PUBLIC_COURSES}:${event.authorUserId}`,
      });
    });
  }

  /** The same account or course reported again and again. */
  @OnEvent(SafetyReportFiled.NAME, OPTS)
  async onReportFiled(event: SafetyReportFiled) {
    await this.safely('reports', async () => {
      const report = await this.reports.findById(event.reportId);
      if (report?.targetOwnerId) {
        const count = await this.reports.countAgainstOwner(
          report.targetOwnerId,
        );
        if (count >= ALERT_RULES.reportsPerAccount) {
          await this.alerts.raise({
            type: AlertType.REPEATED_REPORTS,
            severity: 'high',
            subjectType: 'user',
            subjectId: report.targetOwnerId,
            summary: `${count} reports have been filed against one account`,
            details: { reports: count, latest: event.reference },
            dedupeKey: `${AlertType.REPEATED_REPORTS}:user:${report.targetOwnerId}`,
          });
        }
      }
      if (event.targetType === 'course') {
        const reporters = await this.reports.distinctReporters(
          'course',
          event.targetId,
        );
        if (reporters >= ALERT_RULES.distinctCourseReporters) {
          await this.alerts.raise({
            type: AlertType.REPEATED_REPORTS,
            severity: 'high',
            subjectType: 'course',
            subjectId: event.targetId,
            summary: `"${event.targetName}" was reported by ${reporters} different learners`,
            details: { reporters, latest: event.reference },
            dedupeKey: `${AlertType.REPEATED_REPORTS}:course:${event.targetId}`,
          });
        }
      }
    });
  }

  /** Phone numbers, bank details or payment links in teacher content. */
  @OnEvent(LearnerFacingTextSaved.NAME, OPTS)
  async onTextSaved(event: LearnerFacingTextSaved) {
    await this.safely('text screening', async () => {
      const findings = findSuspiciousText(event.text);
      if (!findings.length) return;
      await this.alerts.raise({
        type: AlertType.SUSPICIOUS_TEXT,
        severity: findings.includes('bank_details') ? 'critical' : 'high',
        subjectType:
          event.targetType === 'announcement' ? 'class' : event.targetType,
        subjectId: event.targetId,
        summary: `Teacher content mentions ${findings.join(', ').replace(/_/g, ' ')}`,
        details: {
          findings,
          authorUserId: event.authorUserId,
          targetType: event.targetType,
          excerpt: event.text.slice(0, 300),
        },
        dedupeKey: `${AlertType.SUSPICIOUS_TEXT}:${event.targetType}:${event.targetId}`,
      });
    });
  }

  /** Repeated failed logins on staff, school admin or teacher accounts. */
  @OnEvent(LoginFailed.NAME, OPTS)
  async onLoginFailed(event: LoginFailed) {
    await this.safely('failed logins', async () => {
      if (
        event.role === (UserRole.LEARNER as string) ||
        event.role === (UserRole.PARENT as string)
      ) {
        return;
      }
      await this.signals.record('login_failed', event.userId, event.userId);
      const since = new Date(
        Date.now() - ALERT_RULES.failedLoginWindowMinutes * MINUTE,
      );
      const count = await this.signals.countSince(
        'login_failed',
        event.userId,
        since,
      );
      if (count < ALERT_RULES.failedLogins) return;
      await this.alerts.raise({
        type: AlertType.FAILED_LOGINS,
        severity:
          event.role === (UserRole.SUPER_ADMIN as string) ? 'critical' : 'high',
        subjectType: 'user',
        subjectId: event.userId,
        summary: `${count} failed logins in ${ALERT_RULES.failedLoginWindowMinutes} minutes on a ${event.role.replace('_', ' ')} account`,
        details: { attempts: count, lastIp: event.ip ?? null },
        dedupeKey: `${AlertType.FAILED_LOGINS}:${event.userId}`,
      });
    });
  }

  @OnEvent(PaymentFailed.NAME, OPTS)
  async onPaymentFailed(event: PaymentFailed) {
    await this.safely('payments', async () => {
      const since = new Date(
        Date.now() - ALERT_RULES.failedPaymentWindowHours * 60 * MINUTE,
      );
      const count = await this.subscriptions.countRecentFailures(
        event.userId,
        since,
      );
      if (count < ALERT_RULES.failedPayments) return;
      await this.alerts.raise({
        type: AlertType.PAYMENT_FAILURES,
        severity: 'normal',
        subjectType: 'user',
        subjectId: event.userId,
        summary: `${count} failed payments in ${ALERT_RULES.failedPaymentWindowHours} hours on one account`,
        details: { failures: count, lastReference: event.reference },
        dedupeKey: `${AlertType.PAYMENT_FAILURES}:${event.userId}`,
      });
    });
  }

  private async checkNetwork(
    kind: string,
    ip: string | undefined,
    userId: string,
    verb: string,
  ) {
    if (!ip) return;
    await this.signals.record(kind, ip, userId);
    const since = new Date(
      Date.now() - ALERT_RULES.sameNetworkWindowMinutes * MINUTE,
    );
    const accounts = await this.signals.distinctUsersSince(kind, ip, since);
    if (accounts < ALERT_RULES.sameNetworkAccounts) return;
    await this.alerts.raise({
      type: AlertType.SAME_NETWORK_SIGNUPS,
      severity: 'high',
      subjectType: 'network',
      subjectId: ip,
      summary: `${accounts} accounts ${verb} from the same network within ${ALERT_RULES.sameNetworkWindowMinutes} minutes`,
      details: { accounts, kind },
      dedupeKey: `${AlertType.SAME_NETWORK_SIGNUPS}:${kind}:${ip}`,
    });
  }

  private async checkNewTeacherLearners(teacherUserId: string) {
    if (!(await this.isNewAccount(teacherUserId))) return;
    const classes = await this.classes.listForTeacher(teacherUserId);
    const learners = new Set(classes.flatMap((c) => c.studentUserIds)).size;
    if (learners < ALERT_RULES.newTeacherLearners) return;
    await this.alerts.raise({
      type: AlertType.NEW_TEACHER_MANY_LEARNERS,
      severity: 'high',
      subjectType: 'user',
      subjectId: teacherUserId,
      summary: `A teacher who joined in the last ${ALERT_RULES.newAccountDays} days already has ${learners} learners`,
      details: { learners, classes: classes.length },
      dedupeKey: `${AlertType.NEW_TEACHER_MANY_LEARNERS}:${teacherUserId}`,
    });
  }

  private async isNewAccount(userId: string): Promise<boolean> {
    const user = await this.users.findById(userId);
    if (!user?.createdAt) return false;
    return (
      Date.now() - user.createdAt.getTime() <
      ALERT_RULES.newAccountDays * 24 * 60 * MINUTE
    );
  }

  private async safely(label: string, run: () => Promise<void>) {
    try {
      await run();
    } catch (error) {
      this.logger.error(`Activity check (${label}) failed: ${String(error)}`);
    }
  }
}
