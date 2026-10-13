import { Inject, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { PAYMENT_PORT } from '../../common/tokens/repository.tokens';
import type { PaymentPort } from './interfaces/payment.port';
import {
  UserSubscription,
  UserSubscriptionDocument,
} from './schemas/subscription.schema';

const PLANS = {
  free: { amountKobo: 0, label: 'Free' },
  individual_premium: { amountKobo: 500000, label: 'Individual Premium' },
  school: { amountKobo: 2500000, label: 'School Plan' },
} as const;

@Injectable()
export class SubscriptionsService {
  constructor(
    @InjectModel(UserSubscription.name)
    private readonly subscriptionModel: Model<UserSubscription>,
    @Inject(PAYMENT_PORT) private readonly paymentPort: PaymentPort,
  ) {}

  listPlans() {
    return Object.entries(PLANS).map(([code, plan]) => ({
      code,
      label: plan.label,
      amountKobo: plan.amountKobo,
    }));
  }

  async getOrCreate(userId: string): Promise<UserSubscriptionDocument> {
    const existing = await this.subscriptionModel.findOne({ userId }).exec();
    if (existing) return existing;
    return this.subscriptionModel.create({ userId, planCode: 'free' });
  }

  async checkout(input: {
    userId: string;
    email: string;
    planCode: keyof typeof PLANS;
  }) {
    const plan = PLANS[input.planCode];
    if (!plan || input.planCode === 'free') {
      return this.subscriptionModel.findOneAndUpdate(
        { userId: input.userId },
        { planCode: 'free', status: 'active' },
        { upsert: true, new: true },
      );
    }
    const payment = await this.paymentPort.initializePayment({
      userId: input.userId,
      email: input.email,
      planCode: input.planCode,
      amountKobo: plan.amountKobo,
    });
    return this.subscriptionModel.findOneAndUpdate(
      { userId: input.userId },
      {
        planCode: input.planCode,
        status: 'pending',
        paystackReference: payment.reference,
      },
      { upsert: true, new: true },
    ).then((sub) => ({ subscription: sub, payment }));
  }

  confirmPayment(reference: string, planCode: keyof typeof PLANS) {
    return this.subscriptionModel.findOneAndUpdate(
      { paystackReference: reference },
      { planCode, status: 'active' },
      { new: true },
    );
  }
}
