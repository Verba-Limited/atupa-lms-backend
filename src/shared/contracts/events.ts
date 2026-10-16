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
