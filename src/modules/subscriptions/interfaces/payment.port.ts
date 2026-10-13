export interface PaymentInitRequest {
  userId: string;
  email: string;
  planCode: string;
  amountKobo: number;
}

export interface PaymentInitResponse {
  reference: string;
  authorizationUrl: string;
}

export interface PaymentPort {
  initializePayment(input: PaymentInitRequest): Promise<PaymentInitResponse>;
  verifyWebhookSignature(payload: string, signature?: string): boolean;
}
