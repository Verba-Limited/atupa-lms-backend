import { Page, PageRequest } from '../../../../shared/domain/pagination';
import {
  OwnerType,
  Payment,
  PaymentStatus,
  Subscription,
} from '../../domain/subscription.entities';

export const SUBSCRIPTION_REPOSITORY = Symbol('SUBSCRIPTION_REPOSITORY');
export const PAYMENT_REPOSITORY = Symbol('PAYMENT_REPOSITORY');

export interface SubscriptionRepository {
  findByOwner(
    ownerType: OwnerType,
    ownerId: string,
  ): Promise<Subscription | null>;
  upsertForOwner(
    ownerType: OwnerType,
    ownerId: string,
    patch: Partial<Subscription>,
  ): Promise<Subscription>;
  countActive(): Promise<Record<string, number>>;
}

export interface PaymentRepository {
  create(input: Omit<Payment, 'id'>): Promise<Payment>;
  findByReference(reference: string): Promise<Payment | null>;
  /** Atomically moves a pending payment to a final status; null if it was not pending. */
  settle(
    reference: string,
    patch: { status: PaymentStatus; paidAt?: Date; failureReason?: string },
  ): Promise<Payment | null>;
  list(
    filter: { status?: PaymentStatus; ownerId?: string },
    page: PageRequest,
  ): Promise<Page<Payment>>;
  revenueSince(since: Date): Promise<{ amountKobo: number; count: number }>;
}
