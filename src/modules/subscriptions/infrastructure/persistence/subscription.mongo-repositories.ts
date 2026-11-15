import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { PageRequest } from '../../../../shared/domain/pagination';
import {
  paginate,
  toEntity,
} from '../../../../shared/infrastructure/mongo/mongo-mapper';
import type {
  PaymentFilter,
  PaymentRepository,
  PlanRepository,
  SubscriptionFilter,
  SubscriptionRepository,
} from '../../application/ports/subscription.repositories.port';
import {
  OwnerType,
  Payment,
  PaymentStatus,
  Plan,
  Subscription,
} from '../../domain/subscription.entities';
import {
  PaymentRecord,
  PlanRecord,
  SubscriptionRecord,
} from './subscription.schemas';

type PlanDoc = Plan & { id: string };

@Injectable()
export class PlanMongoRepository implements PlanRepository {
  constructor(
    @InjectModel(PlanRecord.name) private readonly model: Model<PlanRecord>,
  ) {}

  async list(includeInactive: boolean) {
    const docs = await this.model
      .find(includeInactive ? {} : { isActive: true })
      .sort({ order: 1, tier: 1 })
      .lean()
      .exec();
    return docs.map((d) => toEntity<PlanDoc>(d) as Plan);
  }

  async findByCode(code: string) {
    return toEntity<PlanDoc>(
      await this.model.findOne({ code: code.toLowerCase() }).lean().exec(),
    );
  }

  count() {
    return this.model.countDocuments().exec();
  }

  async create(plan: Plan) {
    const created = await this.model.create(plan);
    return toEntity<PlanDoc>(created.toObject()) as Plan;
  }

  async update(code: string, patch: Partial<Plan>) {
    return toEntity<PlanDoc>(
      await this.model
        .findOneAndUpdate(
          { code: code.toLowerCase() },
          { $set: patch },
          { returnDocument: 'after' },
        )
        .lean()
        .exec(),
    );
  }
}

@Injectable()
export class SubscriptionMongoRepository implements SubscriptionRepository {
  constructor(
    @InjectModel(SubscriptionRecord.name)
    private readonly model: Model<SubscriptionRecord>,
  ) {}

  async findByOwner(ownerType: OwnerType, ownerId: string) {
    return toEntity<Subscription>(
      await this.model.findOne({ ownerType, ownerId }).lean().exec(),
    );
  }

  async upsertForOwner(
    ownerType: OwnerType,
    ownerId: string,
    patch: Partial<Subscription>,
  ) {
    const doc = await this.model
      .findOneAndUpdate(
        { ownerType, ownerId },
        { $set: patch },
        { upsert: true, returnDocument: 'after' },
      )
      .lean()
      .exec();
    return toEntity<Subscription>(doc) as Subscription;
  }

  async countActive() {
    const rows = await this.model
      .aggregate<{ _id: string; count: number }>([
        { $match: { status: 'active', currentPeriodEnd: { $gt: new Date() } } },
        { $group: { _id: '$planCode', count: { $sum: 1 } } },
      ])
      .exec();
    return Object.fromEntries(rows.map((r) => [r._id, r.count]));
  }

  list(filter: SubscriptionFilter, page: PageRequest) {
    const query: Record<string, unknown> = {};
    if (filter.ownerType) query.ownerType = filter.ownerType;
    if (filter.ownerId) query.ownerId = filter.ownerId;
    if (filter.planCode) query.planCode = filter.planCode;
    if (filter.status) query.status = filter.status;
    if (filter.activeOnly) query.currentPeriodEnd = { $gt: new Date() };
    return paginate<Subscription>(this.model, query, page, {
      currentPeriodEnd: -1,
    });
  }
}

@Injectable()
export class PaymentMongoRepository implements PaymentRepository {
  constructor(
    @InjectModel(PaymentRecord.name)
    private readonly model: Model<PaymentRecord>,
  ) {}

  async create(input: Omit<Payment, 'id'>) {
    const created = await this.model.create(input);
    return toEntity<Payment>(created.toObject()) as Payment;
  }

  async findByReference(reference: string) {
    return toEntity<Payment>(
      await this.model.findOne({ reference }).lean().exec(),
    );
  }

  async settle(
    reference: string,
    patch: { status: PaymentStatus; paidAt?: Date; failureReason?: string },
  ) {
    return toEntity<Payment>(
      await this.model
        .findOneAndUpdate(
          { reference, status: 'pending' },
          { $set: patch },
          { returnDocument: 'after' },
        )
        .lean()
        .exec(),
    );
  }

  list(filter: PaymentFilter, page: PageRequest) {
    const query: Record<string, unknown> = {};
    if (filter.status) query.status = filter.status;
    if (filter.ownerId) query.ownerId = filter.ownerId;
    if (filter.planCode) query.planCode = filter.planCode;
    if (filter.from || filter.to) {
      query.createdAt = {
        ...(filter.from ? { $gte: filter.from } : {}),
        ...(filter.to ? { $lte: filter.to } : {}),
      };
    }
    return paginate<Payment>(this.model, query, page);
  }

  countFailedSince(initiatedByUserId: string, since: Date) {
    return this.model
      .countDocuments({
        initiatedByUserId,
        status: 'failed',
        updatedAt: { $gte: since },
      })
      .exec();
  }

  async revenueSince(since: Date) {
    const [row] = await this.model
      .aggregate<{ amountKobo: number; count: number }>([
        { $match: { status: 'success', paidAt: { $gte: since } } },
        {
          $group: {
            _id: null,
            amountKobo: { $sum: '$amountKobo' },
            count: { $sum: 1 },
          },
        },
      ])
      .exec();
    return { amountKobo: row?.amountKobo ?? 0, count: row?.count ?? 0 };
  }
}
