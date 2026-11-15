import { Inject, Injectable, Logger } from '@nestjs/common';
import { Page, PageRequest } from '../../../shared/domain/pagination';
import { AuditEntry, sanitizeDetails } from '../domain/audit-entry.entity';
import type {
  AuditFilter,
  AuditRepository,
} from './ports/audit.repository.port';
import { AUDIT_REPOSITORY } from './ports/audit.repository.port';

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(
    @Inject(AUDIT_REPOSITORY) private readonly entries: AuditRepository,
  ) {}

  /** Never fails the request that is being recorded. */
  async record(
    entry: Omit<AuditEntry, 'id' | 'details'> & { details?: unknown },
  ) {
    try {
      await this.entries.create({
        ...entry,
        details: (sanitizeDetails(entry.details ?? null) ?? null) as Record<
          string,
          unknown
        > | null,
      });
    } catch (error) {
      this.logger.error(`Could not record ${entry.action}: ${String(error)}`);
    }
  }

  list(filter: AuditFilter, page: PageRequest): Promise<Page<AuditEntry>> {
    return this.entries.list(filter, page);
  }
}
