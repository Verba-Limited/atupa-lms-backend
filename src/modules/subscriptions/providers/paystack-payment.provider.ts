import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import {
  PaymentInitRequest,
  PaymentInitResponse,
  PaymentPort,
} from '../interfaces/payment.port';

@Injectable()
export class PaystackPaymentProvider implements PaymentPort {
  constructor(private readonly configService: ConfigService) {}

  async initializePayment(
    input: PaymentInitRequest,
  ): Promise<PaymentInitResponse> {
    const reference = `ATUPA-${randomUUID()}`;
    const baseUrl =
      this.configService.get<string>('APP_BASE_URL') ?? 'http://localhost:4000';
    return {
      reference,
      authorizationUrl: `${baseUrl}/api/v1/subscriptions/mock-checkout?reference=${reference}&plan=${input.planCode}`,
    };
  }

  verifyWebhookSignature(_payload: string, _signature?: string): boolean {
    return Boolean(this.configService.get<string>('PAYSTACK_SECRET_KEY'));
  }
}
