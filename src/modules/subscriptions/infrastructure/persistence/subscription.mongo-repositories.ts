import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { PageRequest } from '../../../../shared/domain/pagination';
import {
  paginate,
  toEntity,
} from '../../../../shared/infrastructure/mongo/mongo-mapper';
import type {
  PaymentRepository,
  SubscriptionRepository,
} from '../../application/ports/subscription.repositories.port';
import {
  OwnerType,
  Payment,
  PaymentStatus,
  Subscription,
} from '../../domain/subscription.entities';
import { PaymentRecord, SubscriptionRecord } from './subscription.schemas';

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

  list(
    filter: { status?: PaymentStatus; ownerId?: string },
    page: PageRequest,
  ) {
    const query: Record<string, unknown> = {};
    if (filter.status) query.status = filter.status;
    if (filter.ownerId) query.ownerId = filter.ownerId;
    return paginate<Payment>(this.model, query, page);
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
