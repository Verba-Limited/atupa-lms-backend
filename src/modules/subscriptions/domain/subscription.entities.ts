/** Plan codes are set by admins (S-01); "free" always exists. */
export type PlanCode = string;
export type OwnerType = 'user' | 'school';

export const FREE_PLAN_CODE = 'free';

export interface Plan {
  code: PlanCode;
  label: string;
  description?: string;
  /** Plans are tiers: 0 is free, higher tiers unlock more. */
  tier: number;
  /** Price per period in kobo (NGN x 100). */
  amountKobo: number;
  periodDays: number;
  ownerType: OwnerType;
  features: string[];
  /** Inactive plans cannot be bought; existing subscribers keep them. */
  isActive: boolean;
  order: number;
}

/**
 * Starting plans from PRD section 29, seeded once into the database. Admins
 * then edit plans and prices; changes never affect already-paid periods.
 */
export const DEFAULT_PLANS: Plan[] = [
  {
    code: FREE_PLAN_CODE,
    label: 'Free',
    tier: 0,
    amountKobo: 0,
    periodDays: 0,
    ownerType: 'user',
    features: ['Limited courses', 'Basic lessons', 'Limited games'],
    isActive: true,
    order: 0,
  },
  {
    code: 'individual_premium',
    label: 'Individual Premium',
    tier: 1,
    amountKobo: 500_000,
    periodDays: 30,
    ownerType: 'user',
    features: [
      'Full courses',
      'Games',
      'Certificates',
      'Advanced learning materials',
    ],
    isActive: true,
    order: 1,
  },
  {
    code: 'school',
    label: 'School Plan',
    tier: 2,
    amountKobo: 2_500_000,
    periodDays: 30,
    ownerType: 'school',
    features: [
      'Multiple teachers',
      'Multiple students',
      'School dashboard',
      'Reports',
      'Administration tools',
    ],
    isActive: true,
    order: 2,
  },
];

/** Limits on manual plan changes by admins (refunds, school deals). */
export const MAX_MANUAL_GRANT_DAYS = 366;
export const MAX_MANUAL_PERIOD_DAYS = 2 * 366;

export type SubscriptionStatus = 'active' | 'cancelled';

export interface Subscription {
  id: string;
  ownerType: OwnerType;
  ownerId: string;
  planCode: PlanCode;
  status: SubscriptionStatus;
  currentPeriodStart?: Date;
  currentPeriodEnd?: Date;
  /** Set when an admin changed the plan by hand. */
  lastManualChange?: {
    action: 'grant' | 'cancel';
    days?: number;
    reason: string;
    byUserId: string;
    at: Date;
  } | null;
  updatedAt?: Date;
}

export function isSubscriptionActive(
  sub: Subscription | null,
  now = new Date(),
): boolean {
  return (
    !!sub &&
    sub.status === 'active' &&
    sub.planCode !== FREE_PLAN_CODE &&
    !!sub.currentPeriodEnd &&
    sub.currentPeriodEnd.getTime() > now.getTime()
  );
}

/** Paying again before expiry extends the current period. */
export function extendPeriod(
  sub: Subscription | null,
  periodDays: number,
  now = new Date(),
): { start: Date; end: Date } {
  const base =
    sub?.currentPeriodEnd && sub.currentPeriodEnd > now
      ? sub.currentPeriodEnd
      : now;
  return {
    start:
      sub && isSubscriptionActive(sub, now) && sub.currentPeriodStart
        ? sub.currentPeriodStart
        : now,
    end: new Date(base.getTime() + periodDays * 86_400_000),
  };
}

export type PaymentStatus = 'pending' | 'success' | 'failed';

export interface Payment {
  id: string;
  reference: string;
  ownerType: OwnerType;
  ownerId: string;
  planCode: PlanCode;
  amountKobo: number;
  currency: 'NGN';
  status: PaymentStatus;
  initiatedByUserId: string;
  paidAt?: Date;
  failureReason?: string;
  createdAt?: Date;
}
