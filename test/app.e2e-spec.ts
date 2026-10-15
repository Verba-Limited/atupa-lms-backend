import { createTestApp, TestContext } from './support/test-app';

describe('App boot (e2e)', () => {
  let ctx: TestContext;

  beforeAll(async () => {
    ctx = await createTestApp();
  }, 120_000);

  afterAll(() => ctx?.close());

  it('serves health without auth', async () => {
    const res = await ctx.http().get('/api/v1/health').expect(200);
    expect(res.body.data.status).toBe('ok');
  });

  it('seeds Yoruba, Igbo and Hausa', async () => {
    const res = await ctx.http().get('/api/v1/languages').expect(200);
    expect(res.body.data.map((l: { code: string }) => l.code)).toEqual([
      'yoruba',
      'igbo',
      'hausa',
    ]);
  });

  it('requires a token by default (secure by default)', async () => {
    await ctx.http().get('/api/v1/users/me').expect(401);
  });
});
