/**
 * Integration events published between bounded contexts of the modular
 * monolith. Producers publish through the EventBus port; consumers subscribe
 * with @OnEvent(<Event>.name) in their presentation/events adapters.
 *
 * Events carry ids and small facts only, never persistence documents.
 */
export abstract class IntegrationEvent {
  readonly occurredAt = new Date();
  abstract readonly name: string;
}

// ---- Identity -------------------------------------------------------------

export class PasswordResetRequested extends IntegrationEvent {
  static readonly NAME = 'identity.password_reset_requested';
  readonly name = PasswordResetRequested.NAME;
  constructor(
    readonly userId: string,
    readonly email: string,
    readonly firstName: string | undefined,
    readonly resetToken: string,
  ) {
    super();
  }
}

export class UserInvited extends IntegrationEvent {
  static readonly NAME = 'identity.user_invited';
  readonly name = UserInvited.NAME;
  constructor(
    readonly userId: string,
    readonly email: string,
    readonly firstName: string | undefined,
    readonly role: string,
    readonly setPasswordToken: string,
    readonly invitedByName?: string,
  ) {
    super();
  }
}

export class UserDeleted extends IntegrationEvent {
  static readonly NAME = 'identity.user_deleted';
  readonly name = UserDeleted.NAME;
  constructor(
    readonly userId: string,
    readonly role: string,
  ) {
    super();
  }
}

// ---- Catalog / library ----------------------------------------------------

export class CoursePublished extends IntegrationEvent {
  static readonly NAME = 'catalog.course_published';
  readonly name = CoursePublished.NAME;
  constructor(
    readonly courseId: string,
    readonly title: string,
    readonly languageCode: string,
  ) {
    super();
  }
}

export class GamePublished extends IntegrationEvent {
  static readonly NAME = 'library.game_published';
  readonly name = GamePublished.NAME;
  constructor(
    readonly gameId: string,
    readonly title: string,
    readonly languageCodes: string[],
  ) {
    super();
  }
}

// ---- Learning -------------------------------------------------------------

export class LessonCompleted extends IntegrationEvent {
  static readonly NAME = 'learning.lesson_completed';
  readonly name = LessonCompleted.NAME;
  constructor(
    readonly userId: string,
    readonly courseId: string,
    readonly lessonId: string,
  ) {
    super();
  }
}

export class ActivityCompleted extends IntegrationEvent {
  static readonly NAME = 'learning.activity_completed';
  readonly name = ActivityCompleted.NAME;
  constructor(
    readonly userId: string,
    readonly courseId: string,
    readonly lessonId: string,
    readonly activityId: string,
    readonly activityType: string,
    readonly correct: boolean,
  ) {
    super();
  }
}

export class QuizAttemptSubmitted extends IntegrationEvent {
  static readonly NAME = 'learning.quiz_attempt_submitted';
  readonly name = QuizAttemptSubmitted.NAME;
  constructor(
    readonly userId: string,
    readonly attemptId: string,
    readonly quizId: string,
    readonly quizTitle: string,
    readonly courseId: string,
    readonly lessonId: string | undefined,
    readonly scorePercent: number,
    readonly passed: boolean,
    readonly durationSeconds: number,
  ) {
    super();
  }
}

// ---- Progress / gamification -----------------------------------------------

export class CourseCompleted extends IntegrationEvent {
  static readonly NAME = 'progress.course_completed';
  readonly name = CourseCompleted.NAME;
  constructor(
    readonly userId: string,
    readonly courseId: string,
  ) {
    super();
  }
}

export class BadgeEarned extends IntegrationEvent {
  static readonly NAME = 'progress.badge_earned';
  readonly name = BadgeEarned.NAME;
  constructor(
    readonly userId: string,
    readonly badgeCode: string,
    readonly badgeName: string,
  ) {
    super();
  }
}

// ---- GameCard / games -------------------------------------------------------

export class GamecardScanned extends IntegrationEvent {
  static readonly NAME = 'gamecard.scanned';
  readonly name = GamecardScanned.NAME;
  constructor(
    readonly userId: string,
    readonly cardCode: string,
    readonly languageCode: string,
    /** True only for the first scan of this card by this user today. */
    readonly rewardable: boolean,
  ) {
    super();
  }
}

export class GamePlayed extends IntegrationEvent {
  static readonly NAME = 'gamecard.game_played';
  readonly name = GamePlayed.NAME;
  constructor(
    readonly userId: string,
    /** Game id, or `card:<code>` for GameCard language challenges. */
    readonly gameRef: string,
    readonly scorePercent: number,
    readonly durationSeconds: number,
    readonly rewardable: boolean,
  ) {
    super();
  }
}

// ---- Certificates -----------------------------------------------------------

export class CertificateIssued extends IntegrationEvent {
  static readonly NAME = 'certificates.issued';
  readonly name = CertificateIssued.NAME;
  constructor(
    readonly userId: string,
    readonly certificateId: string,
    readonly courseId: string,
    readonly courseTitle: string,
    readonly verificationCode: string,
  ) {
    super();
  }
}

// ---- Classes / assignments --------------------------------------------------

export class ClassAnnouncementPosted extends IntegrationEvent {
  static readonly NAME = 'classes.announcement_posted';
  readonly name = ClassAnnouncementPosted.NAME;
  constructor(
    readonly classroomId: string,
    readonly className: string,
    readonly studentIds: string[],
    readonly title: string,
    readonly body: string,
  ) {
    super();
  }
}

export class AssignmentCreated extends IntegrationEvent {
  static readonly NAME = 'assignments.created';
  readonly name = AssignmentCreated.NAME;
  constructor(
    readonly assignmentId: string,
    readonly title: string,
    readonly learnerIds: string[],
    readonly dueAt?: Date,
  ) {
    super();
  }
}

export class AssignmentReviewed extends IntegrationEvent {
  static readonly NAME = 'assignments.reviewed';
  readonly name = AssignmentReviewed.NAME;
  constructor(
    readonly assignmentId: string,
    readonly title: string,
    readonly learnerId: string,
    readonly score: number | undefined,
    readonly feedback: string | undefined,
  ) {
    super();
  }
}

// ---- Schools ----------------------------------------------------------------

export class SchoolMemberRemoved extends IntegrationEvent {
  static readonly NAME = 'schools.member_removed';
  readonly name = SchoolMemberRemoved.NAME;
  constructor(
    readonly schoolId: string,
    readonly userId: string,
  ) {
    super();
  }
}

// ---- Subscriptions ------------------------------------------------------------

export class SubscriptionActivated extends IntegrationEvent {
  static readonly NAME = 'subscriptions.activated';
  readonly name = SubscriptionActivated.NAME;
  constructor(
    readonly ownerType: 'user' | 'school',
    readonly ownerId: string,
    readonly planCode: string,
    readonly currentPeriodEnd: Date,
  ) {
    super();
  }
}

// ---- Admin, review and trust & safety -------------------------------------------

export class UserRegistered extends IntegrationEvent {
  static readonly NAME = 'identity.user_registered';
  readonly name = UserRegistered.NAME;
  constructor(
    readonly userId: string,
    readonly role: string,
    readonly ip?: string,
  ) {
    super();
  }
}

export class LoginFailed extends IntegrationEvent {
  static readonly NAME = 'identity.login_failed';
  readonly name = LoginFailed.NAME;
  constructor(
    readonly userId: string,
    readonly role: string,
    readonly ip?: string,
  ) {
    super();
  }
}

export class VerificationDecided extends IntegrationEvent {
  static readonly NAME = 'identity.verification_decided';
  readonly name = VerificationDecided.NAME;
  constructor(
    readonly subjectType: 'user' | 'school',
    readonly subjectId: string,
    /** User to notify (the teacher, or the school's admin). */
    readonly notifyUserId: string | undefined,
    readonly approved: boolean,
    readonly reason?: string,
  ) {
    super();
  }
}

export class ContentReviewDecided extends IntegrationEvent {
  static readonly NAME = 'catalog.review_decided';
  readonly name = ContentReviewDecided.NAME;
  constructor(
    readonly contentType: string,
    readonly contentId: string,
    readonly title: string,
    readonly authorUserId: string | undefined,
    readonly approved: boolean,
    readonly comment?: string,
  ) {
    super();
  }
}

export class CourseVisibilityRequested extends IntegrationEvent {
  static readonly NAME = 'catalog.visibility_requested';
  readonly name = CourseVisibilityRequested.NAME;
  constructor(
    readonly courseId: string,
    readonly title: string,
    readonly authorUserId: string,
  ) {
    super();
  }
}

export class CourseMadePrivateByAdmin extends IntegrationEvent {
  static readonly NAME = 'catalog.course_made_private';
  readonly name = CourseMadePrivateByAdmin.NAME;
  constructor(
    readonly courseId: string,
    readonly title: string,
    readonly authorUserId: string | undefined,
    readonly reason: string,
  ) {
    super();
  }
}

/** Teacher-written text that learners will read (lessons, announcements). */
export class LearnerFacingTextSaved extends IntegrationEvent {
  static readonly NAME = 'content.learner_text_saved';
  readonly name = LearnerFacingTextSaved.NAME;
  constructor(
    readonly authorUserId: string,
    readonly authorRole: string,
    readonly targetType: 'course' | 'lesson' | 'announcement',
    readonly targetId: string,
    readonly text: string,
  ) {
    super();
  }
}

export class LearnersJoinedClass extends IntegrationEvent {
  static readonly NAME = 'classes.learners_joined';
  readonly name = LearnersJoinedClass.NAME;
  constructor(
    readonly classroomId: string,
    readonly teacherUserId: string,
    readonly learnerIds: string[],
    readonly ip?: string,
  ) {
    super();
  }
}

export class PaymentFailed extends IntegrationEvent {
  static readonly NAME = 'subscriptions.payment_failed';
  readonly name = PaymentFailed.NAME;
  constructor(
    readonly userId: string,
    readonly reference: string,
    readonly reason: string,
  ) {
    super();
  }
}

export class SafetyReportFiled extends IntegrationEvent {
  static readonly NAME = 'safety.report_filed';
  readonly name = SafetyReportFiled.NAME;
  constructor(
    readonly reportId: string,
    readonly reference: string,
    readonly severity: string,
    readonly targetType: string,
    readonly targetId: string,
    readonly targetName: string,
    readonly reason: string,
  ) {
    super();
  }
}

export class SafetyReportResolved extends IntegrationEvent {
  static readonly NAME = 'safety.report_resolved';
  readonly name = SafetyReportResolved.NAME;
  constructor(
    readonly reportId: string,
    readonly reference: string,
    readonly reporterId: string,
    readonly outcome: string,
    /** Account that receives a warning, when the outcome is a warning. */
    readonly warnedUserId?: string,
  ) {
    super();
  }
}

export class AlertRaised extends IntegrationEvent {
  static readonly NAME = 'safety.alert_raised';
  readonly name = AlertRaised.NAME;
  constructor(
    readonly alertId: string,
    readonly type: string,
    readonly severity: string,
    readonly summary: string,
  ) {
    super();
  }
}
