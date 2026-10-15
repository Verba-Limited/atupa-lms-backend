import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { AppConfig } from '../../../../config/app-config';
import {
  AssignmentCreated,
  AssignmentReviewed,
  BadgeEarned,
  CertificateIssued,
  ClassAnnouncementPosted,
  CourseCompleted,
  CoursePublished,
  GamePublished,
  PasswordResetRequested,
  QuizAttemptSubmitted,
  SubscriptionActivated,
  UserInvited,
} from '../../../../shared/contracts/events';
import { UserRole } from '../../../../shared/domain/user-role';
import { CatalogQueryService } from '../../../catalog';
import { UsersService } from '../../../identity';
import { renderEmail } from '../../application/email-templates';
import { NotificationsService } from '../../application/notifications.service';
import { NotificationType } from '../../domain/notification.entity';

const OPTS = { promisify: true } as const;

/** Inbound adapter: turns integration events into in-app and email notifications. */
@Injectable()
export class NotificationsListeners {
  constructor(
    private readonly notifications: NotificationsService,
    private readonly users: UsersService,
    private readonly catalog: CatalogQueryService,
    private readonly config: AppConfig,
  ) {}

  // ---- Account emails ------------------------------------------------------

  @OnEvent(PasswordResetRequested.NAME, OPTS)
  async onPasswordReset(event: PasswordResetRequested) {
    await this.notifications.sendEmail(
      renderEmail({
        to: event.email,
        subject: 'Reset your ATUPA LMS password',
        greetingName: event.firstName,
        paragraphs: [
          'We received a request to reset your password. The link expires in 1 hour.',
        ],
        action: {
          label: 'Reset password',
          url: `${this.config.frontendUrl}/reset-password?token=${event.resetToken}`,
        },
        footnote: 'If you did not request this, you can ignore this email.',
      }),
    );
  }

  @OnEvent(UserInvited.NAME, OPTS)
  async onUserInvited(event: UserInvited) {
    await this.notifications.sendEmail(
      renderEmail({
        to: event.email,
        subject: 'You have been invited to ATUPA LMS',
        greetingName: event.firstName,
        paragraphs: [
          `${event.invitedByName ?? 'ATUPA'} created a ${event.role.replace('_', ' ')} account for you.`,
          'Set your password to get started. The link expires in 7 days.',
        ],
        action: {
          label: 'Set your password',
          url: `${this.config.frontendUrl}/set-password?token=${event.setPasswordToken}`,
        },
      }),
    );
  }

  // ---- Content announcements ----------------------------------------------

  @OnEvent(CoursePublished.NAME, OPTS)
  async onCoursePublished(event: CoursePublished) {
    const learnerIds = await this.users.findIds({
      role: UserRole.LEARNER,
      isActive: true,
      preferredLanguageCode: event.languageCode,
    });
    await this.notifications.notify(learnerIds, {
      type: NotificationType.NEW_COURSE,
      title: 'New course available',
      body: `${event.title} is now available.`,
      data: { courseId: event.courseId },
    });
  }

  @OnEvent(GamePublished.NAME, OPTS)
  async onGamePublished(event: GamePublished) {
    for (const languageCode of event.languageCodes) {
      const learnerIds = await this.users.findIds({
        role: UserRole.LEARNER,
        isActive: true,
        preferredLanguageCode: languageCode,
      });
      await this.notifications.notify(learnerIds, {
        type: NotificationType.NEW_GAME,
        title: 'New ATUPA game',
        body: `Try the new game: ${event.title}.`,
        data: { gameId: event.gameId },
      });
    }
  }

  // ---- Learning --------------------------------------------------------------

  @OnEvent(AssignmentCreated.NAME, OPTS)
  async onAssignmentCreated(event: AssignmentCreated) {
    const due = event.dueAt
      ? ` Due ${event.dueAt.toISOString().slice(0, 10)}.`
      : '';
    await this.notifications.notify(event.learnerIds, {
      type: NotificationType.ASSIGNMENT,
      title: 'New assignment',
      body: `${event.title}.${due}`,
      data: { assignmentId: event.assignmentId },
    });
    for (const learnerId of event.learnerIds) {
      await this.notifications.notifyParentsOf(learnerId, (name) => ({
        type: NotificationType.ASSIGNMENT,
        title: 'New assignment for your child',
        body: `${name} has a new assignment: ${event.title}.${due}`,
        data: { assignmentId: event.assignmentId, childId: learnerId },
      }));
    }
  }

  @OnEvent(AssignmentReviewed.NAME, OPTS)
  async onAssignmentReviewed(event: AssignmentReviewed) {
    const score = event.score !== undefined ? ` Score: ${event.score}.` : '';
    await this.notifications.notify([event.learnerId], {
      type: NotificationType.ASSIGNMENT_FEEDBACK,
      title: 'Your teacher reviewed your work',
      body: `${event.title}.${score} ${event.feedback ?? ''}`.trim(),
      data: { assignmentId: event.assignmentId },
    });
    await this.notifications.notifyParentsOf(event.learnerId, (name) => ({
      type: NotificationType.ASSIGNMENT_FEEDBACK,
      title: 'Teacher feedback',
      body: `${name}'s "${event.title}" was reviewed.${score}`,
      data: { assignmentId: event.assignmentId, childId: event.learnerId },
    }));
  }

  @OnEvent(QuizAttemptSubmitted.NAME, OPTS)
  async onQuizSubmitted(event: QuizAttemptSubmitted) {
    const outcome = event.passed ? 'passed' : 'did not pass yet';
    await this.notifications.notify([event.userId], {
      type: NotificationType.QUIZ_RESULT,
      title: 'Quiz result',
      body: `You scored ${event.scorePercent}% on ${event.quizTitle} and ${outcome}.`,
      data: { quizId: event.quizId, attemptId: event.attemptId },
    });
    await this.notifications.notifyParentsOf(event.userId, (name) => ({
      type: NotificationType.QUIZ_RESULT,
      title: "Your child's quiz score is available",
      body: `${name} scored ${event.scorePercent}% on ${event.quizTitle}.`,
      data: { quizId: event.quizId, childId: event.userId },
    }));
  }

  @OnEvent(CourseCompleted.NAME, OPTS)
  async onCourseCompleted(event: CourseCompleted) {
    const course = await this.catalog.findCourse(event.courseId);
    const title = course?.title ?? 'a course';
    await this.notifications.notify([event.userId], {
      type: NotificationType.COURSE_COMPLETED,
      title: 'Course completed!',
      body: `Congratulations on completing ${title}.`,
      data: { courseId: event.courseId },
    });
    const parentIds = await this.notifications.notifyParentsOf(
      event.userId,
      (name) => ({
        type: NotificationType.COURSE_COMPLETED,
        title: 'Course completed',
        body: `Your child ${name} completed ${title}.`,
        data: { courseId: event.courseId, childId: event.userId },
      }),
    );
    const child = await this.users.findById(event.userId);
    await this.notifications.emailUsers(parentIds, (parent) =>
      renderEmail({
        to: parent.email,
        subject: `${child?.firstName ?? 'Your child'} completed ${title}`,
        greetingName: parent.firstName,
        paragraphs: [
          `Your child ${child?.firstName ?? ''} has completed ${title} on ATUPA LMS.`,
        ],
        action: {
          label: 'View progress',
          url: `${this.config.frontendUrl}/parent`,
        },
      }),
    );
  }

  @OnEvent(CertificateIssued.NAME, OPTS)
  async onCertificateIssued(event: CertificateIssued) {
    await this.notifications.notify([event.userId], {
      type: NotificationType.CERTIFICATE,
      title: 'Your certificate is ready',
      body: `Download your certificate for ${event.courseTitle}.`,
      data: { certificateId: event.certificateId },
    });
    await this.notifications.emailUsers([event.userId], (user) =>
      renderEmail({
        to: user.email,
        subject: `Your ATUPA certificate: ${event.courseTitle}`,
        greetingName: user.firstName,
        paragraphs: [
          `Well done! Your certificate for ${event.courseTitle} has been issued.`,
        ],
        action: {
          label: 'View certificate',
          url: `${this.config.frontendUrl}/certificates/verify/${event.verificationCode}`,
        },
      }),
    );
    await this.notifications.notifyParentsOf(event.userId, (name) => ({
      type: NotificationType.CERTIFICATE,
      title: 'New certificate',
      body: `${name} earned a certificate for ${event.courseTitle}.`,
      data: { certificateId: event.certificateId, childId: event.userId },
    }));
  }

  @OnEvent(BadgeEarned.NAME, OPTS)
  async onBadgeEarned(event: BadgeEarned) {
    await this.notifications.notify([event.userId], {
      type: NotificationType.BADGE,
      title: 'Badge unlocked',
      body: `You earned the "${event.badgeName}" badge.`,
      data: { badgeCode: event.badgeCode },
    });
    await this.notifications.notifyParentsOf(event.userId, (name) => ({
      type: NotificationType.BADGE,
      title: 'New badge',
      body: `Your child ${name} earned the "${event.badgeName}" badge.`,
      data: { badgeCode: event.badgeCode, childId: event.userId },
    }));
  }

  @OnEvent(ClassAnnouncementPosted.NAME, OPTS)
  async onAnnouncement(event: ClassAnnouncementPosted) {
    const content = {
      type: NotificationType.ANNOUNCEMENT,
      title: `${event.className}: ${event.title}`,
      body: event.body,
      data: { classroomId: event.classroomId },
    };
    await this.notifications.notify(event.studentIds, content);
    for (const studentId of event.studentIds) {
      await this.notifications.notifyParentsOf(studentId, () => content);
    }
  }

  @OnEvent(SubscriptionActivated.NAME, OPTS)
  async onSubscriptionActivated(event: SubscriptionActivated) {
    if (event.ownerType !== 'user') return;
    await this.notifications.notify([event.ownerId], {
      type: NotificationType.SUBSCRIPTION,
      title: 'Premium activated',
      body: `Your plan is active until ${event.currentPeriodEnd.toISOString().slice(0, 10)}.`,
    });
  }
}
