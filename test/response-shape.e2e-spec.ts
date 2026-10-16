import { createTestApp, TestContext } from './support/test-app';

/** The frontend relies on one success shape and one error shape. */
describe('Response envelope (e2e)', () => {
  let ctx: TestContext;

  beforeAll(async () => {
    ctx = await createTestApp();
  }, 120_000);

  afterAll(() => ctx?.close());

  const expectError = (body: Record<string, unknown>, status: number) => {
    expect(body).toMatchObject({ success: false, statusCode: status });
    expect(typeof body.message).toBe('string');
    expect(typeof body.path).toBe('string');
    expect(typeof body.timestamp).toBe('string');
  };

  it('wraps success responses', async () => {
    const res = await ctx.http().get('/api/v1/languages').expect(200);
    expect(res.body).toMatchObject({
      success: true,
      message: expect.any(String),
    });
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it.each([
    ['401 missing token', 'get', '/api/v1/users/me', 401],
    ['400 malformed id', 'get', '/api/v1/courses/not-an-id', 400],
    ['404 unknown route', 'get', '/api/v1/nope', 404],
    [
      '404 domain not found',
      'get',
      '/api/v1/courses/000000000000000000000000',
      404,
    ],
    [
      '401 forged webhook',
      'post',
      '/api/v1/subscriptions/webhooks/paystack',
      401,
    ],
  ] as const)('formats %s', async (_label, method, path, status) => {
    const res = await ctx.http()[method](path).expect(status);
    expectError(res.body, status);
  });

  it('flattens validation errors into message + errors[]', async () => {
    const res = await ctx
      .http()
      .post('/api/v1/auth/login')
      .send({ email: 'bad' })
      .expect(400);
    expectError(res.body, 400);
    expect(res.body.errors).toEqual(
      expect.arrayContaining(['email must be an email']),
    );
    expect(res.body.message).toBe(res.body.errors[0]);
  });

  it('formats 403 role errors and 409 conflicts', async () => {
    const body = {
      email: 'dup@atupa.test',
      password: 'Passw0rd!',
      role: 'parent',
      firstName: 'N',
    };
    const first = await ctx
      .http()
      .post('/api/v1/auth/register')
      .send(body)
      .expect(201);
    expectError(
      (await ctx.http().post('/api/v1/auth/register').send(body).expect(409))
        .body,
      409,
    );
    const forbidden = await ctx
      .http()
      .get('/api/v1/admin/users')
      .set('Authorization', `Bearer ${first.body.data.accessToken}`)
      .expect(403);
    expectError(forbidden.body, 403);
  });
});
