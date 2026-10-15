export const PAYMENT_GATEWAY = Symbol('PAYMENT_GATEWAY');

export interface InitializePaymentInput {
  email: string;
  amountKobo: number;
  reference: string;
  callbackUrl: string;
  metadata: Record<string, string>;
}

export interface VerifiedPayment {
  reference: string;
  status: 'success' | 'failed' | 'pending';
  amountKobo: number;
  currency: string;
  paidAt?: Date;
  gatewayResponse?: string;
}

/** Outbound port to a Nigerian payment provider (Paystack today). */
export interface PaymentGateway {
  initialize(
    input: InitializePaymentInput,
  ): Promise<{ authorizationUrl: string; reference: string }>;
  verify(reference: string): Promise<VerifiedPayment>;
  isValidWebhookSignature(
    rawBody: Buffer,
    signature: string | undefined,
  ): boolean;
}
