import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { randomUUID } from 'crypto';
import type { Actor } from '../../../shared/application/actor';
import type { EventBus } from '../../../shared/application/event-bus.port';
import { EVENT_BUS } from '../../../shared/application/event-bus.port';
import {
  PaymentFailed,
  SubscriptionActivated,
} from '../../../shared/contracts/events';
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  UnauthorizedError,
  ValidationError,
} from '../../../shared/domain/errors';
import { Page, PageRequest } from '../../../shared/domain/pagination';
import { UserRole } from '../../../shared/domain/user-role';
import {
  DEFAULT_PLANS,
  extendPeriod,
  FREE_PLAN_CODE,
  isSubscriptionActive,
  MAX_MANUAL_GRANT_DAYS,
  MAX_MANUAL_PERIOD_DAYS,
  OwnerType,
  Payment,
  Plan,
  PlanCode,
  Subscription,
} from '../domain/subscription.entities';
import type { PaymentGateway } from './ports/payment-gateway.port';
import { PAYMENT_GATEWAY } from './ports/payment-gateway.port';
import type {
  PaymentFilter,
  PaymentRepository,
  PlanRepository,
  SubscriptionFilter,
  SubscriptionRepository,
} from './ports/subscription.repositories.port';
import {
  PAYMENT_REPOSITORY,
  PLAN_REPOSITORY,
  SUBSCRIPTION_REPOSITORY,
} from './ports/subscription.repositories.port';

export const PAYMENT_CALLBACK_URL = Symbol('PAYMENT_CALLBACK_URL');

export interface CheckoutResult {
  reference: string;
  authorizationUrl: string;
  plan: Plan;
}

@Injectable()
export class SubscriptionsService implements OnModuleInit {
  private readonly logger = new Logger(SubscriptionsService.name);

  constructor(
    @Inject(PLAN_REPOSITORY) private readonly plans: PlanRepository,
    @Inject(SUBSCRIPTION_REPOSITORY)
    private readonly subscriptions: SubscriptionRepository,
    @Inject(PAYMENT_REPOSITORY) private readonly payments: PaymentRepository,
    @Inject(PAYMENT_GATEWAY) private readonly gateway: PaymentGateway,
    @Inject(PAYMENT_CALLBACK_URL) private readonly callbackUrl: string,
    @Inject(EVENT_BUS) private readonly events: EventBus,
  ) {}

  /** Seeds the starting plans once; admins edit them afterwards. */
  async onModuleInit(): Promise<void> {
    if ((await this.plans.count()) > 0) return;
    for (const plan of DEFAULT_PLANS) await this.plans.create(plan);
    this.logger.log('Seeded default plans');
  }

  /** Plans on sale, cheapest tier first. */
  listPlans(): Promise<Plan[]> {
    return this.plans.list(false);
  }

  async getMine(actor: Actor) {
    const [personal, school] = await Promise.all([
      this.subscriptions.findByOwner('user', actor.userId),
      actor.schoolId
        ? this.subscriptions.findByOwner('school', actor.schoolId)
        : null,
    ]);
    const active = [personal, school].filter((s) => isSubscriptionActive(s));
    const plans = await this.plans.list(true);
    const tierOf = (code: string) =>
      plans.find((p) => p.code === code)?.tier ?? 0;
    return {
      personal: personal ?? {
        planCode: FREE_PLAN_CODE,
        status: 'active',
      },
      school,
      hasPremiumAccess: active.length > 0,
      /** Highest tier the user currently has (0 = free). */
      tier: Math.max(
        0,
        ...active.map((s) => tierOf((s as Subscription).planCode)),
      ),
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
    const plan = await this.plans.findByCode(planCode);
    if (!plan || !plan.isActive || plan.amountKobo === 0) {
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
    filter: PaymentFilter,
    page: PageRequest,
  ): Promise<Page<Payment>> {
    return this.payments.list(filter, page);
  }

  // ---- Admin: plans (S-01) -------------------------------------------------

  listAllPlans(): Promise<Plan[]> {
    return this.plans.list(true);
  }

  async createPlan(input: Omit<Plan, 'isActive' | 'order'> & Partial<Plan>) {
    const code = input.code.toLowerCase();
    if (await this.plans.findByCode(code)) {
      throw new ConflictError(`A plan with code ${code} already exists`);
    }
    assertPlanShape(input);
    return this.plans.create({
      ...input,
      code,
      description: input.description,
      isActive: input.isActive ?? true,
      order: input.order ?? input.tier,
    });
  }

  /** Price changes apply to new payments only; paid periods are untouched. */
  async updatePlan(code: string, patch: Partial<Omit<Plan, 'code'>>) {
    const plan = await this.plans.findByCode(code);
    if (!plan) throw new NotFoundError('Plan not found');
    const next = { ...plan, ...patch };
    if (plan.code === FREE_PLAN_CODE) {
      if (next.amountKobo !== 0 || next.tier !== 0 || !next.isActive) {
        throw new ValidationError(
          'The free plan must stay free, at tier 0 and active',
        );
      }
    } else {
      assertPlanShape(next);
    }
    return (await this.plans.update(plan.code, patch)) as Plan;
  }

  // ---- Admin: subscriptions (M-21) ------------------------------------------

  listSubscriptions(filter: SubscriptionFilter, page: PageRequest) {
    return this.subscriptions.list(filter, page);
  }

  /**
   * Gives or extends a plan by hand (refunds, school deals). Capped at
   * MAX_MANUAL_GRANT_DAYS per change and MAX_MANUAL_PERIOD_DAYS ahead.
   */
  async grantManually(
    actor: Actor,
    input: {
      ownerType: OwnerType;
      ownerId: string;
      planCode: PlanCode;
      days: number;
      reason: string;
    },
  ): Promise<Subscription> {
    const plan = await this.plans.findByCode(input.planCode);
    if (!plan || plan.code === FREE_PLAN_CODE) {
      throw new ValidationError('Choose a paid plan to grant');
    }
    if (plan.ownerType !== input.ownerType) {
      throw new ValidationError(
        `The ${plan.label} plan is for a ${plan.ownerType}, not a ${input.ownerType}`,
      );
    }
    if (input.days < 1 || input.days > MAX_MANUAL_GRANT_DAYS) {
      throw new ValidationError(
        `Grant between 1 and ${MAX_MANUAL_GRANT_DAYS} days at a time`,
      );
    }
    const current = await this.subscriptions.findByOwner(
      input.ownerType,
      input.ownerId,
    );
    const samePlan = current?.planCode === plan.code ? current : null;
    const period = extendPeriod(samePlan, input.days);
    const limit = Date.now() + MAX_MANUAL_PERIOD_DAYS * 86_400_000;
    if (period.end.getTime() > limit) {
      throw new ValidationError(
        `A plan cannot run more than ${MAX_MANUAL_PERIOD_DAYS} days ahead`,
      );
    }
    const subscription = await this.subscriptions.upsertForOwner(
      input.ownerType,
      input.ownerId,
      {
        planCode: plan.code,
        status: 'active',
        currentPeriodStart: period.start,
        currentPeriodEnd: period.end,
        lastManualChange: {
          action: 'grant',
          days: input.days,
          reason: input.reason,
          byUserId: actor.userId,
          at: new Date(),
        },
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
    return subscription;
  }

  async cancelManually(
    actor: Actor,
    input: { ownerType: OwnerType; ownerId: string; reason: string },
  ): Promise<Subscription> {
    const current = await this.subscriptions.findByOwner(
      input.ownerType,
      input.ownerId,
    );
    if (!current || current.status !== 'active') {
      throw new NotFoundError('No active subscription to cancel');
    }
    return this.subscriptions.upsertForOwner(input.ownerType, input.ownerId, {
      status: 'cancelled',
      currentPeriodEnd: new Date(),
      lastManualChange: {
        action: 'cancel',
        reason: input.reason,
        byUserId: actor.userId,
        at: new Date(),
      },
    });
  }

  getForOwner(ownerType: OwnerType, ownerId: string) {
    return this.subscriptions.findByOwner(ownerType, ownerId);
  }

  countRecentFailures(userId: string, since: Date): Promise<number> {
    return this.payments.countFailedSince(userId, since);
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
      const failureReason = amountMatches
        ? (verified.gatewayResponse ?? 'Payment failed')
        : 'Amount or currency mismatch';
      const failed = await this.payments.settle(reference, {
        status: 'failed',
        failureReason,
      });
      if (failed) {
        await this.events.publish(
          new PaymentFailed(
            payment.initiatedByUserId,
            reference,
            failureReason,
          ),
        );
      }
      return failed;
    }

    const settled = await this.payments.settle(reference, {
      status: 'success',
      paidAt: verified.paidAt ?? new Date(),
    });
    if (!settled) return this.payments.findByReference(reference);

    const plan = (await this.plans.findByCode(payment.planCode)) ?? {
      code: payment.planCode,
      periodDays: 30,
    };
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

function assertPlanShape(plan: Partial<Plan>): void {
  if (!plan.amountKobo || plan.amountKobo < 100) {
    throw new ValidationError('Paid plans cost at least NGN 1 (100 kobo)');
  }
  if (!plan.periodDays || plan.periodDays < 1) {
    throw new ValidationError('Paid plans need a period of at least 1 day');
  }
  if (plan.tier === undefined || plan.tier < 1) {
    throw new ValidationError('Paid plans are tier 1 or higher');
  }
}
