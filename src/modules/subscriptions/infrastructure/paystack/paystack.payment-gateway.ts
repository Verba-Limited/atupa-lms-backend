import { Injectable, Logger } from '@nestjs/common';
import { createHmac, timingSafeEqual } from 'crypto';
import { ServiceUnavailableError } from '../../../../shared/domain/errors';
import {
  InitializePaymentInput,
  PaymentGateway,
  VerifiedPayment,
} from '../../application/ports/payment-gateway.port';

interface PaystackEnvelope<T> {
  status: boolean;
  message: string;
  data: T;
}

/** Paystack REST adapter (https://paystack.com/docs/api). */
@Injectable()
export class PaystackPaymentGateway implements PaymentGateway {
  private readonly logger = new Logger(PaystackPaymentGateway.name);

  constructor(
    private readonly secretKey: string | undefined,
    private readonly baseUrl: string,
  ) {}

  async initialize(input: InitializePaymentInput) {
    const data = await this.request<{
      authorization_url: string;
      reference: string;
    }>('/transaction/initialize', {
      method: 'POST',
      body: JSON.stringify({
        email: input.email,
        amount: input.amountKobo,
        currency: 'NGN',
        reference: input.reference,
        callback_url: input.callbackUrl,
        metadata: input.metadata,
      }),
    });
    return {
      authorizationUrl: data.authorization_url,
      reference: data.reference,
    };
  }

  async verify(reference: string): Promise<VerifiedPayment> {
    const data = await this.request<{
      status: string;
      amount: number;
      currency: string;
      paid_at?: string;
      reference: string;
      gateway_response?: string;
    }>(`/transaction/verify/${encodeURIComponent(reference)}`, {
      method: 'GET',
    });
    const status =
      data.status === 'success'
        ? 'success'
        : ['failed', 'abandoned', 'reversed'].includes(data.status)
          ? 'failed'
          : 'pending';
    return {
      reference: data.reference,
      status,
      amountKobo: data.amount,
      currency: data.currency,
      paidAt: data.paid_at ? new Date(data.paid_at) : undefined,
      gatewayResponse: data.gateway_response,
    };
  }

  isValidWebhookSignature(
    rawBody: Buffer,
    signature: string | undefined,
  ): boolean {
    if (!this.secretKey || !signature) return false;
    const expected = createHmac('sha512', this.secretKey)
      .update(rawBody)
      .digest('hex');
    const a = Buffer.from(expected);
    const b = Buffer.from(signature);
    return a.length === b.length && timingSafeEqual(a, b);
  }

  private async request<T>(path: string, init: RequestInit): Promise<T> {
    if (!this.secretKey) {
      throw new ServiceUnavailableError('Payments are not configured yet');
    }
    let response: Response;
    try {
      response = await fetch(`${this.baseUrl}${path}`, {
        ...init,
        headers: {
          Authorization: `Bearer ${this.secretKey}`,
          'Content-Type': 'application/json',
        },
        signal: AbortSignal.timeout(15_000),
      });
    } catch (error) {
      this.logger.error(`Paystack request failed: ${(error as Error).message}`);
      throw new ServiceUnavailableError(
        'Payment provider is unreachable, try again',
      );
    }
    const body = (await response
      .json()
      .catch(() => null)) as PaystackEnvelope<T> | null;
    if (!response.ok || !body?.status) {
      this.logger.error(
        `Paystack ${path} -> ${response.status}: ${body?.message}`,
      );
      throw new ServiceUnavailableError(
        body?.message ?? 'Payment provider error',
      );
    }
    return body.data;
  }
}
