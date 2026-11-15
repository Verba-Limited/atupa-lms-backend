import { Page, PageRequest } from '../../../../shared/domain/pagination';
import { Alert, AlertStatus } from '../../domain/alert.entity';
import {
  ReportComment,
  ReportSeverity,
  ReportStatus,
  SafetyReport,
} from '../../domain/safety-report.entity';

export const SAFETY_REPORT_REPOSITORY = Symbol('SAFETY_REPORT_REPOSITORY');
export const ALERT_REPOSITORY = Symbol('ALERT_REPOSITORY');
export const SIGNAL_REPOSITORY = Symbol('SIGNAL_REPOSITORY');

export interface ReportFilter {
  status?: ReportStatus;
  /** Open and in review together. */
  unresolved?: boolean;
  severity?: ReportSeverity;
  assigneeId?: string;
  reporterId?: string;
  targetType?: string;
  targetId?: string;
}

export interface SafetyReportRepository {
  create(input: Omit<SafetyReport, 'id'>): Promise<SafetyReport>;
  findById(id: string): Promise<SafetyReport | null>;
  update(
    id: string,
    patch: Partial<SafetyReport>,
  ): Promise<SafetyReport | null>;
  addComment(id: string, comment: ReportComment): Promise<SafetyReport | null>;
  /** Most serious first, then oldest first. */
  listQueue(
    filter: ReportFilter,
    page: PageRequest,
  ): Promise<Page<SafetyReport>>;
  count(filter: ReportFilter): Promise<number>;
  countAgainstOwner(ownerId: string): Promise<number>;
  distinctReporters(targetType: string, targetId: string): Promise<number>;
}

export interface AlertFilter {
  status?: AlertStatus;
  type?: string;
  severity?: string;
}

export interface AlertRepository {
  /** Creates the alert, or bumps an open one with the same key. */
  raise(
    input: Omit<Alert, 'id' | 'status' | 'occurrences' | 'lastSeenAt'>,
  ): Promise<{ alert: Alert; created: boolean }>;
  findById(id: string): Promise<Alert | null>;
  update(id: string, patch: Partial<Alert>): Promise<Alert | null>;
  list(filter: AlertFilter, page: PageRequest): Promise<Page<Alert>>;
  count(filter: AlertFilter): Promise<number>;
}

/** Short-lived facts used to spot patterns (kept for a few days). */
export interface SignalRepository {
  record(kind: string, key: string, userId: string): Promise<void>;
  /** Distinct users recorded for this kind+key since a time. */
  distinctUsersSince(kind: string, key: string, since: Date): Promise<number>;
  countSince(kind: string, key: string, since: Date): Promise<number>;
}
