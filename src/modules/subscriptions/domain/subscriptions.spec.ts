import { createHmac } from 'crypto';
import { PaystackPaymentGateway } from '../infrastructure/paystack/paystack.payment-gateway';
import {
  extendPeriod,
  isSubscriptionActive,
  Subscription,
} from './subscription.entities';

const sub = (
  end: Date,
  planCode: Subscription['planCode'] = 'individual_premium',
): Subscription => ({
  id: '1',
  ownerType: 'user',
  ownerId: 'u',
  planCode,
  status: 'active',
  currentPeriodStart: new Date('2026-10-01'),
  currentPeriodEnd: end,
});

describe('subscription rules', () => {
  const now = new Date('2026-10-15T00:00:00Z');

  it('is active only before the period ends and never for free', () => {
    expect(isSubscriptionActive(sub(new Date('2026-10-20')), now)).toBe(true);
    expect(isSubscriptionActive(sub(new Date('2026-10-10')), now)).toBe(false);
    expect(isSubscriptionActive(sub(new Date('2026-10-20'), 'free'), now)).toBe(
      false,
    );
  });

  it('extends from the current end when renewing early', () => {
    expect(
      extendPeriod(
        sub(new Date('2026-10-20T00:00:00Z')),
        30,
        now,
      ).end.toISOString(),
    ).toBe('2026-11-19T00:00:00.000Z');
    expect(extendPeriod(null, 30, now).end.toISOString()).toBe(
      '2026-11-14T00:00:00.000Z',
    );
  });
});

describe('Paystack webhook signature', () => {
  const gateway = new PaystackPaymentGateway(
    'sk_test_123',
    'https://api.paystack.co',
  );
  const body = Buffer.from('{"event":"charge.success"}');

  it('accepts only the HMAC-SHA512 of the raw body', () => {
    const valid = createHmac('sha512', 'sk_test_123')
      .update(body)
      .digest('hex');
    expect(gateway.isValidWebhookSignature(body, valid)).toBe(true);
    expect(
      gateway.isValidWebhookSignature(body, valid.replace(/.$/, '0')),
    ).toBe(false);
    expect(gateway.isValidWebhookSignature(body, undefined)).toBe(false);
  });

  it('rejects everything when no secret is configured', () => {
    expect(
      new PaystackPaymentGateway(undefined, 'x').isValidWebhookSignature(
        body,
        'anything',
      ),
    ).toBe(false);
  });
});
