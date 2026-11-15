import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { AppConfig } from '../../../../config/app-config';
import {
  AlertRaised,
  ContentReviewDecided,
  CourseMadePrivateByAdmin,
  CourseVisibilityRequested,
  SafetyReportFiled,
  SafetyReportResolved,
  VerificationDecided,
} from '../../../../shared/contracts/events';
import { UserRole } from '../../../../shared/domain/user-role';
import { UsersService } from '../../../identity';
import { renderEmail } from '../../application/email-templates';
import { NotificationsService } from '../../application/notifications.service';
import { NotificationType } from '../../domain/notification.entity';

const OPTS = { promisify: true } as const;

const CONTENT_LABEL: Record<string, string> = {
  course: 'course',
  lesson: 'lesson',
  course_visibility: 'request to make your course Public',
};

/** Notifications for admin decisions, safety reports and alerts. */
@Injectable()
export class AdminNotificationsListeners {
  constructor(
    private readonly notifications: NotificationsService,
    private readonly users: UsersService,
    private readonly config: AppConfig,
  ) {}

  @OnEvent(VerificationDecided.NAME, OPTS)
  async onVerificationDecided(event: VerificationDecided) {
    if (!event.notifyUserId) return;
    const what =
      event.subjectType === 'school' ? 'Your school' : 'Your account';
    const title = event.approved
      ? `${what} is verified`
      : `${what} could not be verified`;
    const body = event.approved
      ? 'ATUPA checked your documents. Learners will now see your Verified badge.'
      : `ATUPA could not verify your documents. Reason: ${event.reason ?? 'not given'}.`;
    await this.notifications.notify([event.notifyUserId], {
      type: NotificationType.VERIFICATION,
      title,
      body,
    });
    await this.notifications.emailUsers([event.notifyUserId], (user) =>
      renderEmail({
        to: user.email,
        subject: title,
        greetingName: user.firstName,
        paragraphs: [
          body,
          ...(event.approved
            ? []
            : ['If you think this is a mistake, reply to this email.']),
        ],
      }),
    );
  }

  @OnEvent(ContentReviewDecided.NAME, OPTS)
  async onReviewDecided(event: ContentReviewDecided) {
    if (!event.authorUserId) return;
    const label = CONTENT_LABEL[event.contentType] ?? event.contentType;
    const title = event.approved
      ? `Approved: ${event.title}`
      : `Changes needed: ${event.title}`;
    const body = event.approved
      ? `Your ${label} was approved${event.contentType === 'course_visibility' ? '. The course is now Public.' : ' and is now live.'}`
      : `Your ${label} was not approved. ${event.comment ?? ''}`.trim();
    await this.notifications.notify([event.authorUserId], {
      type: NotificationType.CONTENT_REVIEW,
      title,
      body,
      data: { contentType: event.contentType, contentId: event.contentId },
    });
  }

  @OnEvent(CourseMadePrivateByAdmin.NAME, OPTS)
  async onMadePrivate(event: CourseMadePrivateByAdmin) {
    if (!event.authorUserId) return;
    const body = `ATUPA made "${event.title}" private. Reason: ${event.reason}`;
    await this.notifications.notify([event.authorUserId], {
      type: NotificationType.CONTENT_REVIEW,
      title: 'Your course is no longer Public',
      body,
      data: { courseId: event.courseId },
    });
    await this.notifications.emailUsers([event.authorUserId], (user) =>
      renderEmail({
        to: user.email,
        subject: 'Your course is no longer Public',
        greetingName: user.firstName,
        paragraphs: [body],
      }),
    );
  }

  @OnEvent(CourseVisibilityRequested.NAME, OPTS)
  async onPublicRequested(event: CourseVisibilityRequested) {
    await this.notifications.notify(await this.superAdmins(), {
      type: NotificationType.CONTENT_REVIEW,
      title: 'Course waiting for review',
      body: `A teacher asked to make "${event.title}" Public.`,
      data: { courseId: event.courseId },
    });
  }

  /** Child-safety reports alert Super Admins by email at once. */
  @OnEvent(SafetyReportFiled.NAME, OPTS)
  async onReportFiled(event: SafetyReportFiled) {
    const admins = await this.superAdmins();
    const critical = event.severity === 'critical';
    await this.notifications.notify(admins, {
      type: NotificationType.SAFETY,
      title: critical
        ? `Urgent safety report ${event.reference}`
        : `New safety report ${event.reference}`,
      body: `${event.reason.replace(/_/g, ' ')}: ${event.targetType} "${event.targetName}"`,
      data: { reportId: event.reportId },
    });
    if (!critical) return;
    await this.notifications.emailUsers(admins, (user) =>
      renderEmail({
        to: user.email,
        subject: `Urgent: child-safety report ${event.reference}`,
        greetingName: user.firstName,
        paragraphs: [
          `A ${event.targetType} ("${event.targetName}") was reported for ${event.reason.replace(/_/g, ' ')}.`,
          'Child-safety reports must be handled within 24 hours.',
        ],
        action: {
          label: 'Open the report',
          url: `${this.config.frontendUrl}/admin/safety-reports/${event.reportId}`,
        },
      }),
    );
  }

  @OnEvent(SafetyReportResolved.NAME, OPTS)
  async onReportResolved(event: SafetyReportResolved) {
    await this.notifications.notify([event.reporterId], {
      type: NotificationType.SAFETY,
      title: `Report ${event.reference} handled`,
      body: 'Thank you for telling us. ATUPA has looked into your report and taken action where needed.',
      data: { reportId: event.reportId },
    });
    if (!event.warnedUserId) return;
    const body =
      'ATUPA received a report about your activity and has issued a warning. Please review the ATUPA community rules. Further reports may lead to suspension.';
    await this.notifications.notify([event.warnedUserId], {
      type: NotificationType.SAFETY,
      title: 'Warning from ATUPA',
      body,
    });
    await this.notifications.emailUsers([event.warnedUserId], (user) =>
      renderEmail({
        to: user.email,
        subject: 'Warning from ATUPA',
        greetingName: user.firstName,
        paragraphs: [body],
      }),
    );
  }

  @OnEvent(AlertRaised.NAME, OPTS)
  async onAlert(event: AlertRaised) {
    const admins = await this.superAdmins();
    await this.notifications.notify(admins, {
      type: NotificationType.ADMIN_ALERT,
      title: 'Unusual activity',
      body: event.summary,
      data: { alertId: event.alertId, type: event.type },
    });
    await this.notifications.emailUsers(admins, (user) =>
      renderEmail({
        to: user.email,
        subject: `ATUPA alert (${event.severity}): ${event.summary}`,
        greetingName: user.firstName,
        paragraphs: [event.summary, 'Please look into it on the admin home.'],
        action: {
          label: 'Open alerts',
          url: `${this.config.frontendUrl}/admin/alerts`,
        },
      }),
    );
  }

  private superAdmins(): Promise<string[]> {
    return this.users.findIds({ role: UserRole.SUPER_ADMIN, isActive: true });
  }
}
