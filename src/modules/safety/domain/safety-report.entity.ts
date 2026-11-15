import { randomCode } from '../../../shared/domain/random-code';

export type ReportTargetType = 'teacher' | 'school' | 'course' | 'class';

export enum ReportReason {
  INAPPROPRIATE_CONTENT = 'inappropriate_content',
  INAPPROPRIATE_MESSAGES = 'inappropriate_messages',
  ASKING_FOR_MONEY_OR_DETAILS = 'asking_for_money_or_details',
  FAKE_TEACHER_OR_SCHOOL = 'fake_teacher_or_school',
  COPIED_CONTENT = 'copied_content',
  OTHER = 'other',
}

/** critical = child safety: top of the queue, Super Admins emailed at once. */
export type ReportSeverity = 'critical' | 'high' | 'normal';
export type ReportStatus = 'open' | 'in_review' | 'resolved';

export enum ReportOutcome {
  NO_ACTION = 'no_action',
  WARNING = 'warning',
  HIDE_COURSE = 'hide_course',
  SUSPEND_ACCOUNT = 'suspend_account',
  REMOVE_SCHOOL = 'remove_school',
}

export interface ReportComment {
  authorId: string;
  body: string;
  at: Date;
}

export interface SafetyReport {
  id: string;
  /** Shown to the reporter, e.g. "RPT-7KQ2M9XA". */
  reference: string;
  reporterId: string;
  reporterRole: string;
  targetType: ReportTargetType;
  targetId: string;
  targetName: string;
  /** Account responsible for the target (teacher, author, school admin). */
  targetOwnerId?: string | null;
  /** School behind the target, if any (for "remove the school"). */
  targetSchoolId?: string | null;
  reason: ReportReason;
  note?: string | null;
  attachments: Array<{ mediaId: string; url: string }>;
  severity: ReportSeverity;
  status: ReportStatus;
  assigneeId?: string | null;
  comments: ReportComment[];
  outcome?: ReportOutcome | null;
  outcomeNote?: string | null;
  /** Child-safety reports must be handled within 24 hours. */
  dueAt: Date;
  resolvedAt?: Date | null;
  resolvedByUserId?: string | null;
  createdAt?: Date;
}

const SEVERITY: Record<ReportReason, ReportSeverity> = {
  [ReportReason.INAPPROPRIATE_MESSAGES]: 'critical',
  [ReportReason.ASKING_FOR_MONEY_OR_DETAILS]: 'critical',
  [ReportReason.INAPPROPRIATE_CONTENT]: 'high',
  [ReportReason.FAKE_TEACHER_OR_SCHOOL]: 'high',
  [ReportReason.COPIED_CONTENT]: 'normal',
  [ReportReason.OTHER]: 'normal',
};

const RESPONSE_HOURS: Record<ReportSeverity, number> = {
  critical: 24,
  high: 48,
  normal: 72,
};

export const SEVERITY_RANK: Record<ReportSeverity, number> = {
  critical: 3,
  high: 2,
  normal: 1,
};

export function severityOf(reason: ReportReason): ReportSeverity {
  return SEVERITY[reason];
}

export function responseDeadline(
  severity: ReportSeverity,
  from = new Date(),
): Date {
  return new Date(from.getTime() + RESPONSE_HOURS[severity] * 3_600_000);
}

export function newReportReference(): string {
  return `RPT-${randomCode(8)}`;
}

/** Which outcomes make sense for each kind of target. */
export function allowedOutcomes(target: ReportTargetType): ReportOutcome[] {
  const common = [
    ReportOutcome.NO_ACTION,
    ReportOutcome.WARNING,
    ReportOutcome.SUSPEND_ACCOUNT,
  ];
  switch (target) {
    case 'course':
      return [
        ...common,
        ReportOutcome.HIDE_COURSE,
        ReportOutcome.REMOVE_SCHOOL,
      ];
    case 'school':
      return [
        ReportOutcome.NO_ACTION,
        ReportOutcome.WARNING,
        ReportOutcome.REMOVE_SCHOOL,
      ];
    default:
      return [...common, ReportOutcome.REMOVE_SCHOOL];
  }
}
