import { Page, PageRequest } from '../../../../shared/domain/pagination';
import { AuditEntry } from '../../domain/audit-entry.entity';

export const AUDIT_REPOSITORY = Symbol('AUDIT_REPOSITORY');

export interface AuditFilter {
  actorId?: string;
  actorRole?: string;
  /** Matches part of the action name, e.g. "users" or "publish". */
  action?: string;
  targetId?: string;
  from?: Date;
  to?: Date;
}

export interface AuditRepository {
  create(entry: Omit<AuditEntry, 'id'>): Promise<AuditEntry>;
  list(filter: AuditFilter, page: PageRequest): Promise<Page<AuditEntry>>;
}
