import { INestApplication } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import { createHmac } from 'crypto';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { Connection } from 'mongoose';
import { getConnectionToken } from '@nestjs/mongoose';
import request from 'supertest';
import { AppModule } from '../../src/app.module';
import { configureApp } from '../../src/main';
import { PAYMENT_GATEWAY } from '../../src/modules/subscriptions/application/ports/payment-gateway.port';
import type {
  PaymentGateway,
  VerifiedPayment,
} from '../../src/modules/subscriptions/application/ports/payment-gateway.port';

export const PAYSTACK_TEST_SECRET = 'sk_test_e2e_secret';

/** Fake Paystack: real signature check, scripted verify results. */
export class FakePaymentGateway implements PaymentGateway {
  verifyResults = new Map<string, VerifiedPayment>();
  initialized: Array<{ reference: string; amountKobo: number }> = [];

  initialize(input: { reference: string; amountKobo: number }) {
    this.initialized.push(input);
    return Promise.resolve({
      authorizationUrl: `https://checkout.paystack.test/${input.reference}`,
      reference: input.reference,
    });
  }

  verify(reference: string) {
    return Promise.resolve(
      this.verifyResults.get(reference) ?? {
        reference,
        status: 'pending' as const,
        amountKobo: 0,
        currency: 'NGN',
      },
    );
  }

  isValidWebhookSignature(rawBody: Buffer, signature?: string) {
    return signature === signPaystack(rawBody);
  }
}

export function signPaystack(body: Buffer | string): string {
  return createHmac('sha512', PAYSTACK_TEST_SECRET).update(body).digest('hex');
}

export interface TestContext {
  app: INestApplication;
  mongo: MongoMemoryServer;
  gateway: FakePaymentGateway;
  http: () => ReturnType<typeof request>;
  close: () => Promise<void>;
}

export async function createTestApp(
  env: Record<string, string> = {},
): Promise<TestContext> {
  const mongo = await MongoMemoryServer.create();
  process.env.MONGODB_URI = mongo.getUri();
  Object.assign(process.env, env);
  const gateway = new FakePaymentGateway();
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(PAYMENT_GATEWAY)
    .useValue(gateway)
    .compile();
  const app = moduleRef.createNestApplication<NestExpressApplication>({
    rawBody: true,
    logger: process.env.E2E_VERBOSE ? undefined : ['error', 'warn'],
  });
  configureApp(app);
  await app.init();
  return {
    app,
    mongo,
    gateway,
    http: () => request(app.getHttpServer()),
    close: async () => {
      await app.get<Connection>(getConnectionToken()).close();
      await app.close();
      await mongo.stop();
    },
  };
}
