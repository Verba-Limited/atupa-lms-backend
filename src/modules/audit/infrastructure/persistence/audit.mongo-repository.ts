import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Page, PageRequest } from '../../../../shared/domain/pagination';
import { containsPattern } from '../../../../shared/domain/text';
import { MongoCrudRepository } from '../../../../shared/infrastructure/mongo/mongo-crud.repository';
import type {
  AuditFilter,
  AuditRepository,
} from '../../application/ports/audit.repository.port';
import { AuditEntry } from '../../domain/audit-entry.entity';
import { AuditEntryRecord } from './audit-entry.schema';

@Injectable()
export class AuditMongoRepository
  extends MongoCrudRepository<AuditEntry>
  implements AuditRepository
{
  constructor(
    @InjectModel(AuditEntryRecord.name) model: Model<AuditEntryRecord>,
  ) {
    super(model);
  }

  list(filter: AuditFilter, page: PageRequest): Promise<Page<AuditEntry>> {
    const query: Record<string, unknown> = {};
    if (filter.actorId) query.actorId = filter.actorId;
    if (filter.actorRole) query.actorRole = filter.actorRole;
    if (filter.targetId) query.targetId = filter.targetId;
    if (filter.action) query.action = containsPattern(filter.action);
    if (filter.from || filter.to) {
      query.createdAt = {
        ...(filter.from ? { $gte: filter.from } : {}),
        ...(filter.to ? { $lte: filter.to } : {}),
      };
    }
    return this.paginateBy(query, page, { createdAt: -1 });
  }
}
