import { Page, PageRequest } from '../../../../shared/domain/pagination';
import {
  OwnerType,
  Payment,
  PaymentStatus,
  Plan,
  Subscription,
} from '../../domain/subscription.entities';

export const SUBSCRIPTION_REPOSITORY = Symbol('SUBSCRIPTION_REPOSITORY');
export const PLAN_REPOSITORY = Symbol('PLAN_REPOSITORY');

export interface PlanRepository {
  list(includeInactive: boolean): Promise<Plan[]>;
  findByCode(code: string): Promise<Plan | null>;
  count(): Promise<number>;
  create(plan: Plan): Promise<Plan>;
  update(code: string, patch: Partial<Plan>): Promise<Plan | null>;
}

export interface SubscriptionFilter {
  ownerType?: OwnerType;
  ownerId?: string;
  planCode?: string;
  status?: Subscription['status'];
  /** Only subscriptions whose paid period has not ended. */
  activeOnly?: boolean;
}

export interface PaymentFilter {
  status?: PaymentStatus;
  ownerId?: string;
  planCode?: string;
  from?: Date;
  to?: Date;
}
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
  list(
    filter: SubscriptionFilter,
    page: PageRequest,
  ): Promise<Page<Subscription>>;
}

export interface PaymentRepository {
  create(input: Omit<Payment, 'id'>): Promise<Payment>;
  findByReference(reference: string): Promise<Payment | null>;
  /** Atomically moves a pending payment to a final status; null if it was not pending. */
  settle(
    reference: string,
    patch: { status: PaymentStatus; paidAt?: Date; failureReason?: string },
  ): Promise<Payment | null>;
  list(filter: PaymentFilter, page: PageRequest): Promise<Page<Payment>>;
  countFailedSince(initiatedByUserId: string, since: Date): Promise<number>;
  revenueSince(since: Date): Promise<{ amountKobo: number; count: number }>;
}
