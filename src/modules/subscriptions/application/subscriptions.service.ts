import { Inject, Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import type { Actor } from '../../../shared/application/actor';
import type { EventBus } from '../../../shared/application/event-bus.port';
import { EVENT_BUS } from '../../../shared/application/event-bus.port';
import { SubscriptionActivated } from '../../../shared/contracts/events';
import {
  ForbiddenError,
  NotFoundError,
  UnauthorizedError,
  ValidationError,
} from '../../../shared/domain/errors';
import { Page, PageRequest } from '../../../shared/domain/pagination';
import { UserRole } from '../../../shared/domain/user-role';
import {
  extendPeriod,
  isSubscriptionActive,
  OwnerType,
  Payment,
  PaymentStatus,
  Plan,
  PlanCode,
  PLANS,
  Subscription,
} from '../domain/subscription.entities';
import type { PaymentGateway } from './ports/payment-gateway.port';
import { PAYMENT_GATEWAY } from './ports/payment-gateway.port';
import type {
  PaymentRepository,
  SubscriptionRepository,
} from './ports/subscription.repositories.port';
import {
  PAYMENT_REPOSITORY,
  SUBSCRIPTION_REPOSITORY,
} from './ports/subscription.repositories.port';

export const PAYMENT_CALLBACK_URL = Symbol('PAYMENT_CALLBACK_URL');

export interface CheckoutResult {
  reference: string;
  authorizationUrl: string;
  plan: Plan;
}

@Injectable()
export class SubscriptionsService {
  private readonly logger = new Logger(SubscriptionsService.name);

  constructor(
    @Inject(SUBSCRIPTION_REPOSITORY)
    private readonly subscriptions: SubscriptionRepository,
    @Inject(PAYMENT_REPOSITORY) private readonly payments: PaymentRepository,
    @Inject(PAYMENT_GATEWAY) private readonly gateway: PaymentGateway,
    @Inject(PAYMENT_CALLBACK_URL) private readonly callbackUrl: string,
    @Inject(EVENT_BUS) private readonly events: EventBus,
  ) {}

  listPlans(): Plan[] {
    return Object.values(PLANS);
  }

  async getMine(actor: Actor) {
    const [personal, school] = await Promise.all([
      this.subscriptions.findByOwner('user', actor.userId),
      actor.schoolId
        ? this.subscriptions.findByOwner('school', actor.schoolId)
        : null,
    ]);
    return {
      personal: personal ?? { planCode: 'free' as PlanCode, status: 'active' },
      school,
      hasPremiumAccess:
        isSubscriptionActive(personal) || isSubscriptionActive(school),
    };
  }

  /** Entitlement check used by other modules (premium courses, games...). */
  async hasPremiumAccess(
    userId: string,
    schoolId?: string | null,
  ): Promise<boolean> {
    const personal = await this.subscriptions.findByOwner('user', userId);
    if (isSubscriptionActive(personal)) return true;
    if (!schoolId) return false;
    return isSubscriptionActive(
      await this.subscriptions.findByOwner('school', schoolId),
    );
  }

  async hasActiveSchoolPlan(schoolId: string): Promise<boolean> {
    return isSubscriptionActive(
      await this.subscriptions.findByOwner('school', schoolId),
    );
  }

  async checkout(actor: Actor, planCode: PlanCode): Promise<CheckoutResult> {
    const plan = PLANS[planCode];
    if (!plan || plan.amountKobo === 0) {
      throw new ValidationError('Choose a paid plan to check out');
    }
    let ownerType: OwnerType = 'user';
    let ownerId = actor.userId;
    if (plan.ownerType === 'school') {
      if (actor.role !== UserRole.SCHOOL_ADMIN || !actor.schoolId) {
        throw new ForbiddenError(
          'Only a school administrator can buy the School plan',
        );
      }
      ownerType = 'school';
      ownerId = actor.schoolId;
    }

    const reference = `ATUPA-${randomUUID()}`;
    await this.payments.create({
      reference,
      ownerType,
      ownerId,
      planCode,
      amountKobo: plan.amountKobo,
      currency: 'NGN',
      status: 'pending',
      initiatedByUserId: actor.userId,
    });
    const { authorizationUrl } = await this.gateway.initialize({
      email: actor.email,
      amountKobo: plan.amountKobo,
      reference,
      callbackUrl: this.callbackUrl,
      metadata: { planCode, ownerType, ownerId },
    });
    return { reference, authorizationUrl, plan };
  }

  /** Called by the frontend after Paystack redirects back. */
  async verifyForActor(actor: Actor, reference: string) {
    const payment = await this.payments.findByReference(reference);
    if (!payment) throw new NotFoundError('Payment not found');
    if (
      payment.initiatedByUserId !== actor.userId &&
      actor.role !== UserRole.SUPER_ADMIN
    ) {
      throw new ForbiddenError('This payment belongs to another account');
    }
    const settled = await this.settle(reference);
    return {
      payment: settled,
      subscription: await this.subscriptions.findByOwner(
        payment.ownerType,
        payment.ownerId,
      ),
    };
  }

  /** Paystack webhook: trust nothing in the body until signature + API verify. */
  async handleWebhook(
    rawBody: Buffer | undefined,
    signature: string | undefined,
  ): Promise<void> {
    if (!rawBody || !this.gateway.isValidWebhookSignature(rawBody, signature)) {
      throw new UnauthorizedError('Invalid webhook signature');
    }
    let event: { event?: string; data?: { reference?: string } };
    try {
      event = JSON.parse(rawBody.toString('utf8')) as typeof event;
    } catch {
      throw new ValidationError('Malformed webhook payload');
    }
    if (event.event !== 'charge.success' || !event.data?.reference) return;
    await this.settle(event.data.reference);
  }

  listPayments(
    filter: { status?: PaymentStatus; ownerId?: string },
    page: PageRequest,
  ): Promise<Page<Payment>> {
    return this.payments.list(filter, page);
  }

  async revenueSummary(since: Date) {
    const [revenue, activeByPlan] = await Promise.all([
      this.payments.revenueSince(since),
      this.subscriptions.countActive(),
    ]);
    return { ...revenue, activeSubscriptionsByPlan: activeByPlan };
  }

  /**
   * Confirms a payment with the gateway and activates the plan exactly once,
   * even if the webhook and the redirect verification race.
   */
  private async settle(reference: string): Promise<Payment | null> {
    const payment = await this.payments.findByReference(reference);
    if (!payment) {
      this.logger.warn(`Unknown payment reference ${reference}`);
      return null;
    }
    if (payment.status !== 'pending') return payment;

    const verified = await this.gateway.verify(reference);
    if (verified.status === 'pending') return payment;

    const amountMatches =
      verified.amountKobo === payment.amountKobo &&
      verified.currency === payment.currency;
    if (verified.status !== 'success' || !amountMatches) {
      return this.payments.settle(reference, {
        status: 'failed',
        failureReason: amountMatches
          ? (verified.gatewayResponse ?? 'Payment failed')
          : 'Amount or currency mismatch',
      });
    }

    const settled = await this.payments.settle(reference, {
      status: 'success',
      paidAt: verified.paidAt ?? new Date(),
    });
    if (!settled) return this.payments.findByReference(reference);

    const plan = PLANS[payment.planCode];
    const current = await this.subscriptions.findByOwner(
      payment.ownerType,
      payment.ownerId,
    );
    const sameActivePlan = current?.planCode === plan.code ? current : null;
    const period = extendPeriod(sameActivePlan, plan.periodDays);
    const subscription: Subscription = await this.subscriptions.upsertForOwner(
      payment.ownerType,
      payment.ownerId,
      {
        planCode: plan.code,
        status: 'active',
        currentPeriodStart: period.start,
        currentPeriodEnd: period.end,
      },
    );
    await this.events.publish(
      new SubscriptionActivated(
        subscription.ownerType,
        subscription.ownerId,
        subscription.planCode,
        period.end,
      ),
    );
    return settled;
  }
}
