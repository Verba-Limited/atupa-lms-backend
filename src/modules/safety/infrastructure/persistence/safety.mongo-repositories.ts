import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Page, PageRequest } from '../../../../shared/domain/pagination';
import { MongoCrudRepository } from '../../../../shared/infrastructure/mongo/mongo-crud.repository';
import {
  isObjectId,
  toEntity,
} from '../../../../shared/infrastructure/mongo/mongo-mapper';
import type {
  AlertFilter,
  AlertRepository,
  ReportFilter,
  SafetyReportRepository,
  SignalRepository,
} from '../../application/ports/safety.repositories.port';
import { Alert } from '../../domain/alert.entity';
import {
  ReportComment,
  SafetyReport,
  SEVERITY_RANK,
} from '../../domain/safety-report.entity';
import {
  AlertRecord,
  SafetyReportRecord,
  SignalRecord,
} from './safety.schemas';

function reportQuery(filter: ReportFilter): Record<string, unknown> {
  const query: Record<string, unknown> = {};
  if (filter.status) query.status = filter.status;
  if (filter.unresolved) query.status = { $ne: 'resolved' };
  if (filter.severity) query.severity = filter.severity;
  if (filter.assigneeId) query.assigneeId = filter.assigneeId;
  if (filter.reporterId) query.reporterId = filter.reporterId;
  if (filter.targetType) query.targetType = filter.targetType;
  if (filter.targetId) query.targetId = filter.targetId;
  return query;
}

@Injectable()
export class SafetyReportMongoRepository
  extends MongoCrudRepository<SafetyReport>
  implements SafetyReportRepository
{
  constructor(
    @InjectModel(SafetyReportRecord.name) model: Model<SafetyReportRecord>,
  ) {
    super(model);
  }

  create(input: Omit<SafetyReport, 'id'>) {
    return super.create({
      ...input,
      severityRank: SEVERITY_RANK[input.severity],
    } as Partial<SafetyReport>);
  }

  async addComment(id: string, comment: ReportComment) {
    if (!isObjectId(id)) return null;
    return toEntity<SafetyReport>(
      await this.model
        .findByIdAndUpdate(
          id,
          { $push: { comments: comment } },
          { returnDocument: 'after' },
        )
        .lean()
        .exec(),
    );
  }

  listQueue(
    filter: ReportFilter,
    page: PageRequest,
  ): Promise<Page<SafetyReport>> {
    return this.paginateBy(reportQuery(filter), page, {
      severityRank: -1,
      createdAt: 1,
    });
  }

  count(filter: ReportFilter) {
    return this.model.countDocuments(reportQuery(filter)).exec();
  }

  countAgainstOwner(ownerId: string) {
    return this.model.countDocuments({ targetOwnerId: ownerId }).exec();
  }

  async distinctReporters(targetType: string, targetId: string) {
    const ids = await this.model
      .distinct('reporterId', { targetType, targetId })
      .exec();
    return ids.length;
  }
}

function alertQuery(filter: AlertFilter): Record<string, unknown> {
  const query: Record<string, unknown> = {};
  if (filter.status) query.status = filter.status;
  if (filter.type) query.type = filter.type;
  if (filter.severity) query.severity = filter.severity;
  return query;
}

@Injectable()
export class AlertMongoRepository
  extends MongoCrudRepository<Alert>
  implements AlertRepository
{
  constructor(@InjectModel(AlertRecord.name) model: Model<AlertRecord>) {
    super(model);
  }

  async raise(
    input: Omit<Alert, 'id' | 'status' | 'occurrences' | 'lastSeenAt'>,
  ) {
    const now = new Date();
    const bumped = toEntity<Alert>(
      await this.model
        .findOneAndUpdate(
          { dedupeKey: input.dedupeKey, status: 'open' },
          {
            $inc: { occurrences: 1 },
            $set: { lastSeenAt: now, details: input.details ?? null },
          },
          { returnDocument: 'after' },
        )
        .lean()
        .exec(),
    );
    if (bumped) return { alert: bumped, created: false };
    try {
      const alert = await this.create({
        ...input,
        status: 'open',
        occurrences: 1,
        lastSeenAt: now,
      });
      return { alert, created: true };
    } catch {
      // Another request raised it at the same moment.
      const existing = toEntity<Alert>(
        await this.model
          .findOne({ dedupeKey: input.dedupeKey, status: 'open' })
          .lean()
          .exec(),
      ) as Alert;
      return { alert: existing, created: false };
    }
  }

  list(filter: AlertFilter, page: PageRequest) {
    return this.paginateBy(alertQuery(filter), page, { lastSeenAt: -1 });
  }

  count(filter: AlertFilter) {
    return this.model.countDocuments(alertQuery(filter)).exec();
  }
}

@Injectable()
export class SignalMongoRepository implements SignalRepository {
  constructor(
    @InjectModel(SignalRecord.name)
    private readonly model: Model<SignalRecord>,
  ) {}

  async record(kind: string, key: string, userId: string) {
    await this.model.create({ kind, key, userId, at: new Date() });
  }

  async distinctUsersSince(kind: string, key: string, since: Date) {
    const ids = await this.model
      .distinct('userId', { kind, key, at: { $gte: since } })
      .exec();
    return ids.length;
  }

  countSince(kind: string, key: string, since: Date) {
    return this.model.countDocuments({ kind, key, at: { $gte: since } }).exec();
  }
}
