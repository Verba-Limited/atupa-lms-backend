import { EventEmitter2 } from '@nestjs/event-emitter';
import { PasswordResetRequested } from '../src/shared/contracts/events';
import {
  adminSession,
  auth,
  findCourse,
  register,
  Session,
} from './support/api';
import { createTestApp, TestContext } from './support/test-app';

describe('Passwords and delete endpoints (e2e)', () => {
  let ctx: TestContext;
  let admin: Session;
  let lastResetToken = '';

  beforeAll(async () => {
    ctx = await createTestApp();
    admin = await adminSession(ctx);
    ctx.app
      .get(EventEmitter2)
      .on(PasswordResetRequested.NAME, (e: PasswordResetRequested) => {
        lastResetToken = e.resetToken;
      });
  }, 120_000);

  afterAll(() => ctx?.close());

  it('forgot -> reset password (single-use token, old sessions revoked)', async () => {
    const user = await register(ctx, 'parent');
    await ctx
      .http()
      .post('/api/v1/auth/password/forgot')
      .send({ email: user.email })
      .expect(200);
    expect(lastResetToken).toHaveLength(64);
    await ctx
      .http()
      .post('/api/v1/auth/password/reset')
      .send({ token: lastResetToken, newPassword: 'NewPassw0rd' })
      .expect(200);
    await ctx
      .http()
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: user.refreshToken })
      .expect(401);
    await ctx
      .http()
      .post('/api/v1/auth/login')
      .send({ email: user.email, password: 'NewPassw0rd' })
      .expect(200);
    await ctx
      .http()
      .post('/api/v1/auth/password/reset')
      .send({ token: lastResetToken, newPassword: 'Again1pass' })
      .expect(400);
  });

  it('change password requires the current password', async () => {
    const user = await register(ctx, 'parent');
    await ctx
      .http()
      .post('/api/v1/auth/password/change')
      .set(auth(user))
      .send({ currentPassword: 'wrong', newPassword: 'NewPassw0rd' })
      .expect(401);
    await ctx
      .http()
      .post('/api/v1/auth/password/change')
      .set(auth(user))
      .send({ currentPassword: 'Passw0rd!', newPassword: 'NewPassw0rd' })
      .expect(200);
    await ctx
      .http()
      .post('/api/v1/auth/login')
      .send({ email: user.email, password: 'NewPassw0rd' })
      .expect(200);
  });

  it('deletes (anonymises) my account and its parent links', async () => {
    const learner = await register(ctx, 'learner');
    const parent = await register(ctx, 'parent');
    const code = await ctx
      .http()
      .post('/api/v1/parents/link-codes')
      .set(auth(learner))
      .expect(201);
    await ctx
      .http()
      .post('/api/v1/parents/children')
      .set(auth(parent))
      .send({ code: code.body.data.code })
      .expect(201);

    await ctx
      .http()
      .delete('/api/v1/users/me')
      .set(auth(learner))
      .send({ password: 'wrong' })
      .expect(401);
    await ctx
      .http()
      .delete('/api/v1/users/me')
      .set(auth(learner))
      .send({ password: 'Passw0rd!' })
      .expect(200);
    await ctx.http().get('/api/v1/users/me').set(auth(learner)).expect(401);
    await ctx
      .http()
      .post('/api/v1/auth/login')
      .send({ email: learner.email, password: 'Passw0rd!' })
      .expect(401);
    const children = await ctx
      .http()
      .get('/api/v1/parents/children')
      .set(auth(parent))
      .expect(200);
    expect(children.body.data).toEqual([]);

    // The email can be registered again.
    await ctx
      .http()
      .post('/api/v1/auth/register')
      .send({
        email: learner.email,
        password: 'Passw0rd!',
        role: 'parent',
        firstName: 'New',
      })
      .expect(201);
  });

  it('admin deletes a user but not themselves', async () => {
    const user = await register(ctx, 'teacher');
    await ctx
      .http()
      .delete(`/api/v1/admin/users/${admin.userId}`)
      .set(auth(admin))
      .expect(400);
    await ctx
      .http()
      .delete(`/api/v1/admin/users/${user.userId}`)
      .set(auth(admin))
      .expect(200);
    const res = await ctx
      .http()
      .get(`/api/v1/admin/users/${user.userId}`)
      .set(auth(admin))
      .expect(200);
    expect(res.body.data).toMatchObject({
      isActive: false,
      firstName: 'Deleted',
    });
  });

  it('deletes a notification and unenrolls from an in-progress course', async () => {
    const learner = await register(ctx, 'learner');
    const course = await findCourse(ctx, 'igbo', 'beginner');
    await ctx
      .http()
      .post(`/api/v1/progress/courses/${course.id}/enroll`)
      .set(auth(learner))
      .expect(201);
    await ctx
      .http()
      .delete(`/api/v1/progress/courses/${course.id}/enroll`)
      .set(auth(learner))
      .expect(200);
    await ctx
      .http()
      .delete(`/api/v1/progress/courses/${course.id}/enroll`)
      .set(auth(learner))
      .expect(404);

    const code = await ctx
      .http()
      .post('/api/v1/parents/link-codes')
      .set(auth(learner))
      .expect(201);
    const parent = await register(ctx, 'parent');
    await ctx
      .http()
      .post('/api/v1/parents/children')
      .set(auth(parent))
      .send({ code: code.body.data.code })
      .expect(201);
    const quiz = (
      await ctx.http().get(`/api/v1/courses/${course.id}`).expect(200)
    ).body.data.modules[0].quizzes[0];
    const attempt = await ctx
      .http()
      .post(`/api/v1/learning/quizzes/${quiz.id}/attempts`)
      .set(auth(learner))
      .expect(201);
    await ctx
      .http()
      .post(`/api/v1/learning/attempts/${attempt.body.data.attemptId}/submit`)
      .set(auth(learner))
      .send({ answers: {} })
      .expect(200);
    const list = await ctx
      .http()
      .get('/api/v1/notifications')
      .set(auth(learner))
      .expect(200);
    const id = list.body.data.items[0].id;
    await ctx
      .http()
      .delete(`/api/v1/notifications/${id}`)
      .set(auth(parent))
      .expect(404);
    await ctx
      .http()
      .delete(`/api/v1/notifications/${id}`)
      .set(auth(learner))
      .expect(200);
    await ctx
      .http()
      .delete(`/api/v1/notifications/${id}`)
      .set(auth(learner))
      .expect(404);
  });

  it('only deletes schools without members', async () => {
    const empty = await ctx
      .http()
      .post('/api/v1/schools')
      .set(auth(admin))
      .send({ name: 'Empty School' })
      .expect(201);
    const full = await ctx
      .http()
      .post('/api/v1/schools/register')
      .send({
        name: 'Busy School',
        admin: {
          email: 'busy.admin@atupa.test',
          password: 'Passw0rd!',
          firstName: 'B',
          lastName: 'A',
        },
      })
      .expect(201);
    await ctx
      .http()
      .delete(`/api/v1/schools/${full.body.data.school.id}`)
      .set(auth(admin))
      .expect(409);
    await ctx
      .http()
      .delete(`/api/v1/schools/${empty.body.data.id}`)
      .set({ Authorization: `Bearer ${full.body.data.session.accessToken}` })
      .expect(403);
    await ctx
      .http()
      .delete(`/api/v1/schools/${empty.body.data.id}`)
      .set(auth(admin))
      .expect(200);
  });
});
