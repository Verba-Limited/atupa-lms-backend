import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { PAYMENT_PORT } from '../../common/tokens/repository.tokens';
import { PaystackPaymentProvider } from './providers/paystack-payment.provider';
import {
  UserSubscription,
  UserSubscriptionSchema,
} from './schemas/subscription.schema';
import { SubscriptionsController } from './subscriptions.controller';
import { SubscriptionsService } from './subscriptions.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: UserSubscription.name, schema: UserSubscriptionSchema },
    ]),
  ],
  controllers: [SubscriptionsController],
  providers: [
    SubscriptionsService,
    { provide: PAYMENT_PORT, useClass: PaystackPaymentProvider },
  ],
  exports: [SubscriptionsService],
})
export class SubscriptionsModule {}
