import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AppConfig } from '../../config/app-config';
import { PAYMENT_GATEWAY } from './application/ports/payment-gateway.port';
import {
  PAYMENT_REPOSITORY,
  SUBSCRIPTION_REPOSITORY,
} from './application/ports/subscription.repositories.port';
import {
  PAYMENT_CALLBACK_URL,
  SubscriptionsService,
} from './application/subscriptions.service';
import { PaystackPaymentGateway } from './infrastructure/paystack/paystack.payment-gateway';
import {
  PaymentMongoRepository,
  SubscriptionMongoRepository,
} from './infrastructure/persistence/subscription.mongo-repositories';
import {
  PaymentRecord,
  PaymentSchema,
  SubscriptionRecord,
  SubscriptionSchema,
} from './infrastructure/persistence/subscription.schemas';
import { SubscriptionsController } from './presentation/http/subscriptions.controller';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: SubscriptionRecord.name, schema: SubscriptionSchema },
      { name: PaymentRecord.name, schema: PaymentSchema },
    ]),
  ],
  controllers: [SubscriptionsController],
  providers: [
    SubscriptionsService,
    { provide: SUBSCRIPTION_REPOSITORY, useClass: SubscriptionMongoRepository },
    { provide: PAYMENT_REPOSITORY, useClass: PaymentMongoRepository },
    {
      provide: PAYMENT_GATEWAY,
      inject: [AppConfig],
      useFactory: (config: AppConfig) =>
        new PaystackPaymentGateway(
          config.paystack.secretKey,
          config.paystack.baseUrl,
        ),
    },
    {
      provide: PAYMENT_CALLBACK_URL,
      inject: [AppConfig],
      useFactory: (config: AppConfig) =>
        `${config.frontendUrl}/payments/callback`,
    },
  ],
  exports: [SubscriptionsService],
})
export class SubscriptionsModule {}
