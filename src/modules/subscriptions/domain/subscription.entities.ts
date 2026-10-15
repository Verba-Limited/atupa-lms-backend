export type PlanCode = 'free' | 'individual_premium' | 'school';
export type OwnerType = 'user' | 'school';

export interface Plan {
  code: PlanCode;
  label: string;
  /** Price per period in kobo (NGN x 100). */
  amountKobo: number;
  periodDays: number;
  ownerType: OwnerType;
  features: string[];
}

/**
 * Plans from PRD section 29. Prices are placeholders until the PM confirms
 * pricing; changing them here does not affect already-paid periods.
 */
export const PLANS: Record<PlanCode, Plan> = {
  free: {
    code: 'free',
    label: 'Free',
    amountKobo: 0,
    periodDays: 0,
    ownerType: 'user',
    features: ['Limited courses', 'Basic lessons', 'Limited games'],
  },
  individual_premium: {
    code: 'individual_premium',
    label: 'Individual Premium',
    amountKobo: 500_000,
    periodDays: 30,
    ownerType: 'user',
    features: [
      'Full courses',
      'Games',
      'Certificates',
      'Advanced learning materials',
    ],
  },
  school: {
    code: 'school',
    label: 'School Plan',
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
  },
};

export type SubscriptionStatus = 'active' | 'cancelled';

export interface Subscription {
  id: string;
  ownerType: OwnerType;
  ownerId: string;
  planCode: PlanCode;
  status: SubscriptionStatus;
  currentPeriodStart?: Date;
  currentPeriodEnd?: Date;
  updatedAt?: Date;
}

export function isSubscriptionActive(
  sub: Subscription | null,
  now = new Date(),
): boolean {
  return (
    !!sub &&
    sub.status === 'active' &&
    sub.planCode !== 'free' &&
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
