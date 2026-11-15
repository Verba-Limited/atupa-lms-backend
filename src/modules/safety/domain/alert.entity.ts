export enum AlertType {
  NEW_TEACHER_PUBLIC_COURSES = 'new_teacher_public_courses',
  NEW_TEACHER_MANY_LEARNERS = 'new_teacher_many_learners',
  SAME_NETWORK_SIGNUPS = 'same_network_signups',
  REPEATED_REPORTS = 'repeated_reports',
  SUSPICIOUS_TEXT = 'suspicious_text',
  FAILED_LOGINS = 'failed_logins',
  PAYMENT_FAILURES = 'payment_failures',
}

export type AlertSeverity = 'critical' | 'high' | 'normal';
export type AlertStatus = 'open' | 'acknowledged' | 'resolved';

export interface Alert {
  id: string;
  type: AlertType;
  severity: AlertSeverity;
  subjectType: 'user' | 'school' | 'course' | 'lesson' | 'class' | 'network';
  subjectId: string;
  summary: string;
  details?: Record<string, unknown> | null;
  status: AlertStatus;
  /** One open alert per key; repeats raise `occurrences` instead. */
  dedupeKey: string;
  occurrences: number;
  lastSeenAt: Date;
  note?: string | null;
  handledByUserId?: string | null;
  createdAt?: Date;
}

/** Thresholds for M-29 signals. */
export const ALERT_RULES = {
  newAccountDays: 7,
  newTeacherPublicCourses: 3,
  newTeacherLearners: 50,
  sameNetworkAccounts: 5,
  sameNetworkWindowMinutes: 60,
  reportsPerAccount: 3,
  distinctCourseReporters: 2,
  failedLogins: 5,
  failedLoginWindowMinutes: 15,
  failedPayments: 3,
  failedPaymentWindowHours: 24,
} as const;
