import {
  adminSession,
  auth,
  findCourse,
  register,
  Session,
  uniqueEmail,
} from './support/api';
import { createTestApp, signPaystack, TestContext } from './support/test-app';

/** One test (or more) per security hole found in the review. */
describe('Security fixes (e2e)', () => {
  let ctx: TestContext;
  let admin: Session;

  beforeAll(async () => {
    ctx = await createTestApp();
    admin = await adminSession(ctx);
  }, 120_000);

  afterAll(() => ctx?.close());

  describe('registration', () => {
    it.each(['super_admin', 'school_admin', 'content_creator'])(
      'rejects self-registration as %s',
      async (role) => {
        await ctx
          .http()
          .post('/api/v1/auth/register')
          .send({
            email: uniqueEmail(role),
            password: 'Passw0rd!',
            role,
            firstName: 'X',
            lastName: 'Y',
          })
          .expect(400);
      },
    );

    it('enforces role-specific required fields', async () => {
      const res = await ctx
        .http()
        .post('/api/v1/auth/register')
        .send({
          email: uniqueEmail('l'),
          password: 'Passw0rd!',
          role: 'learner',
          firstName: 'Ada',
        })
        .expect(400);
      expect(res.body.message).toContain('dateOfBirth');
    });

    it('rejects weak passwords and unknown fields', async () => {
      await ctx
        .http()
        .post('/api/v1/auth/register')
        .send({
          email: uniqueEmail('p'),
          password: 'password',
          role: 'parent',
          firstName: 'N',
        })
        .expect(400);
      await ctx
        .http()
        .post('/api/v1/auth/register')
        .send({
          email: uniqueEmail('p'),
          password: 'Passw0rd!',
          role: 'parent',
          firstName: 'N',
          isActive: false,
        })
        .expect(400);
    });
  });

  describe('sessions', () => {
    it('detects refresh-token reuse and revokes the session', async () => {
      const user = await register(ctx, 'parent');
      const first = await ctx
        .http()
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: user.refreshToken })
        .expect(200);
      // Replaying the old (rotated) token fails and revokes everything.
      await ctx
        .http()
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: user.refreshToken })
        .expect(401);
      await ctx
        .http()
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: first.body.data.refreshToken })
        .expect(401);
    });

    it('locks out a deactivated user immediately', async () => {
      const user = await register(ctx, 'parent');
      await ctx.http().get('/api/v1/users/me').set(auth(user)).expect(200);
      await ctx
        .http()
        .patch(`/api/v1/admin/users/${user.userId}`)
        .set(auth(admin))
        .send({ isActive: false })
        .expect(200);
      await ctx.http().get('/api/v1/users/me').set(auth(user)).expect(401);
    });
  });

  describe('answer keys are never exposed to learners', () => {
    it('course outline and lesson view contain no answers', async () => {
      const learner = await register(ctx, 'learner');
      const course = await findCourse(ctx, 'yoruba', 'beginner');
      const outline = await ctx
        .http()
        .get(`/api/v1/courses/${course.id}`)
        .expect(200);
      const lessonId = outline.body.data.modules[0].lessons[0].id;
      const lesson = await ctx
        .http()
        .get(`/api/v1/learning/lessons/${lessonId}`)
        .set(auth(learner))
        .expect(200);
      const json = JSON.stringify([outline.body, lesson.body]);
      expect(json).not.toContain('correctAnswer');
      expect(json).not.toContain('"solution"');
    });
  });

  describe('quizzes', () => {
    it('scores randomised quizzes correctly (answers keyed by question id)', async () => {
      const learner = await register(ctx, 'learner');
      const course = await findCourse(ctx, 'igbo', 'beginner');
      const tree = await ctx
        .http()
        .get(`/api/v1/authoring/courses/${course.id}`)
        .set(auth(admin))
        .expect(200);
      const quiz = tree.body.data.modules[0].quizzes[0];
      await ctx
        .http()
        .patch(`/api/v1/authoring/quizzes/${quiz.id}`)
        .set(auth(admin))
        .send({ randomizeQuestions: true, maxAttempts: 2 })
        .expect(200);

      const start = await ctx
        .http()
        .post(`/api/v1/learning/quizzes/${quiz.id}/attempts`)
        .set(auth(learner))
        .expect(201);
      const answers = Object.fromEntries(
        quiz.questions.map((q: { id: string; correctAnswer: string }) => [
          q.id,
          q.correctAnswer,
        ]),
      );
      const result = await ctx
        .http()
        .post(`/api/v1/learning/attempts/${start.body.data.attemptId}/submit`)
        .set(auth(learner))
        .send({ answers })
        .expect(200);
      expect(result.body.data.scorePercent).toBe(100);

      // Resubmitting the same attempt is rejected.
      await ctx
        .http()
        .post(`/api/v1/learning/attempts/${start.body.data.attemptId}/submit`)
        .set(auth(learner))
        .send({ answers })
        .expect(400);

      // maxAttempts = 2 is enforced.
      const second = await ctx
        .http()
        .post(`/api/v1/learning/quizzes/${quiz.id}/attempts`)
        .set(auth(learner))
        .expect(201);
      await ctx
        .http()
        .post(`/api/v1/learning/attempts/${second.body.data.attemptId}/submit`)
        .set(auth(learner))
        .send({ answers: {} })
        .expect(200);
      await ctx
        .http()
        .post(`/api/v1/learning/quizzes/${quiz.id}/attempts`)
        .set(auth(learner))
        .expect(403);
    });

    it("prevents reviewing someone else's attempt", async () => {
      const a = await register(ctx, 'learner');
      const b = await register(ctx, 'learner');
      const course = await findCourse(ctx, 'hausa', 'beginner');
      const outline = await ctx
        .http()
        .get(`/api/v1/courses/${course.id}`)
        .expect(200);
      const quizId = outline.body.data.modules[0].quizzes[0].id;
      const start = await ctx
        .http()
        .post(`/api/v1/learning/quizzes/${quizId}/attempts`)
        .set(auth(a))
        .expect(201);
      await ctx
        .http()
        .post(`/api/v1/learning/attempts/${start.body.data.attemptId}/submit`)
        .set(auth(b))
        .send({ answers: {} })
        .expect(404);
    });
  });

  describe('payments (Paystack webhook)', () => {
    const webhook = (body: object, signature?: string) => {
      const raw = JSON.stringify(body);
      const req = ctx
        .http()
        .post('/api/v1/subscriptions/webhooks/paystack')
        .set('Content-Type', 'application/json');
      if (signature !== undefined) req.set('x-paystack-signature', signature);
      return req.send(raw);
    };

    it('rejects unsigned and forged webhooks', async () => {
      const body = { event: 'charge.success', data: { reference: 'whatever' } };
      await webhook(body).expect(401);
      await webhook(body, 'forged').expect(401);
    });

    it('activates only after a signed webhook AND a successful verify with matching amount', async () => {
      const learner = await register(ctx, 'learner');
      const checkout = await ctx
        .http()
        .post('/api/v1/subscriptions/checkout')
        .set(auth(learner))
        .send({ planCode: 'individual_premium' })
        .expect(201);
      const reference = checkout.body.data.reference;
      const body = { event: 'charge.success', data: { reference } };

      // Paystack says the amount was smaller than the plan price -> rejected.
      ctx.gateway.verifyResults.set(reference, {
        reference,
        status: 'success',
        amountKobo: 100,
        currency: 'NGN',
      });
      await webhook(body, signPaystack(JSON.stringify(body))).expect(200);
      let mine = await ctx
        .http()
        .get('/api/v1/subscriptions/mine')
        .set(auth(learner))
        .expect(200);
      expect(mine.body.data.hasPremiumAccess).toBe(false);

      // A fresh, correctly paid checkout activates Premium.
      const again = await ctx
        .http()
        .post('/api/v1/subscriptions/checkout')
        .set(auth(learner))
        .send({ planCode: 'individual_premium' })
        .expect(201);
      const ref2 = again.body.data.reference;
      ctx.gateway.verifyResults.set(ref2, {
        reference: ref2,
        status: 'success',
        amountKobo: 500_000,
        currency: 'NGN',
      });
      const body2 = { event: 'charge.success', data: { reference: ref2 } };
      await webhook(body2, signPaystack(JSON.stringify(body2))).expect(200);
      // Replaying the webhook is idempotent.
      await webhook(body2, signPaystack(JSON.stringify(body2))).expect(200);
      mine = await ctx
        .http()
        .get('/api/v1/subscriptions/mine')
        .set(auth(learner))
        .expect(200);
      expect(mine.body.data.hasPremiumAccess).toBe(true);
    });

    it('gates premium courses behind a subscription', async () => {
      const learner = await register(ctx, 'learner');
      const course = await findCourse(ctx, 'yoruba', 'advanced');
      expect(course.isPremium).toBe(true);
      const outline = await ctx
        .http()
        .get(`/api/v1/courses/${course.id}`)
        .expect(200);
      const lessonId = outline.body.data.modules[0].lessons[0].id;
      await ctx
        .http()
        .get(`/api/v1/learning/lessons/${lessonId}`)
        .set(auth(learner))
        .expect(402);
    });

    it('only school admins can buy the school plan', async () => {
      const learner = await register(ctx, 'learner');
      await ctx
        .http()
        .post('/api/v1/subscriptions/checkout')
        .set(auth(learner))
        .send({ planCode: 'school' })
        .expect(403);
    });
  });

  describe('certificates', () => {
    it('cannot be self-issued', async () => {
      const learner = await register(ctx, 'learner');
      await ctx
        .http()
        .post('/api/v1/certificates/issue')
        .set(auth(learner))
        .send({
          learnerName: 'Fake',
          courseId: 'x',
          courseTitle: 'x',
          languageCode: 'yoruba',
        })
        .expect(404);
    });
  });

  describe('parent linking', () => {
    it('requires a valid single-use code generated by the learner', async () => {
      const learner = await register(ctx, 'learner');
      const parent = await register(ctx, 'parent');
      const other = await register(ctx, 'parent');
      await ctx
        .http()
        .post('/api/v1/parents/children')
        .set(auth(parent))
        .send({ code: 'AAAAAAAA' })
        .expect(400);

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
      // Codes are single-use.
      await ctx
        .http()
        .post('/api/v1/parents/children')
        .set(auth(other))
        .send({ code: code.body.data.code })
        .expect(400);
      const children = await ctx
        .http()
        .get('/api/v1/parents/children')
        .set(auth(parent))
        .expect(200);
      expect(children.body.data.map((c: { id: string }) => c.id)).toEqual([
        learner.userId,
      ]);
    });
  });

  describe('reports access', () => {
    it("blocks learners and unlinked parents from other learners' reports", async () => {
      const a = await register(ctx, 'learner');
      const b = await register(ctx, 'learner');
      const parent = await register(ctx, 'parent');
      await ctx
        .http()
        .get(`/api/v1/reports/learners/${a.userId}`)
        .set(auth(a))
        .expect(200);
      await ctx
        .http()
        .get(`/api/v1/reports/learners/${a.userId}`)
        .set(auth(b))
        .expect(403);
      await ctx
        .http()
        .get(`/api/v1/reports/learners/${a.userId}`)
        .set(auth(parent))
        .expect(403);
      await ctx
        .http()
        .get(`/api/v1/dashboards/children/${a.userId}`)
        .set(auth(parent))
        .expect(403);
    });
  });

  describe('content ownership', () => {
    it("teachers cannot modify another teacher's course", async () => {
      const t1 = await register(ctx, 'teacher');
      const t2 = await register(ctx, 'teacher');
      const created = await ctx
        .http()
        .post('/api/v1/authoring/courses')
        .set(auth(t1))
        .send({
          languageCode: 'yoruba',
          level: 'beginner',
          title: 'My Yoruba class',
        })
        .expect(201);
      await ctx
        .http()
        .patch(`/api/v1/authoring/courses/${created.body.data.id}`)
        .set(auth(t2))
        .send({ title: 'Hijacked' })
        .expect(403);
      // Learners cannot author at all.
      const learner = await register(ctx, 'learner');
      await ctx
        .http()
        .post('/api/v1/authoring/courses')
        .set(auth(learner))
        .send({ languageCode: 'yoruba', level: 'beginner', title: 'Nope' })
        .expect(403);
    });
  });

  describe('classes & assignments', () => {
    it('isolates classes and persists assignment status changes', async () => {
      const teacher = await register(ctx, 'teacher');
      const learner = await register(ctx, 'learner');
      const outsider = await register(ctx, 'learner');
      const klass = await ctx
        .http()
        .post('/api/v1/classes')
        .set(auth(teacher))
        .send({ name: 'Primary 5 Yoruba' })
        .expect(201);
      const classId = klass.body.data.id;
      // Independent class: teachers cannot add arbitrary learners by id.
      await ctx
        .http()
        .post(`/api/v1/classes/${classId}/students`)
        .set(auth(teacher))
        .send({ studentIds: [learner.userId] })
        .expect(403);
      await ctx
        .http()
        .post('/api/v1/classes/join')
        .set(auth(learner))
        .send({ code: klass.body.data.joinCode })
        .expect(200);

      const assignment = await ctx
        .http()
        .post('/api/v1/assignments')
        .set(auth(teacher))
        .send({
          classroomId: classId,
          title: 'Write about your family',
          type: 'written_work',
          maxScore: 10,
        })
        .expect(201);
      const id = assignment.body.data.id;

      await ctx
        .http()
        .get(`/api/v1/assignments/classes/${classId}`)
        .set(auth(outsider))
        .expect(403);
      await ctx
        .http()
        .post(`/api/v1/assignments/${id}/submissions/${learner.userId}/review`)
        .set(auth(learner))
        .send({ score: 10 })
        .expect(403);
      await ctx
        .http()
        .post(`/api/v1/assignments/${id}/submit`)
        .set(auth(learner))
        .send({ text: 'Ìdílé mi...' })
        .expect(200);
      await ctx
        .http()
        .post(`/api/v1/assignments/${id}/submissions/${learner.userId}/review`)
        .set(auth(teacher))
        .send({ score: 11 })
        .expect(400);
      await ctx
        .http()
        .post(`/api/v1/assignments/${id}/submissions/${learner.userId}/review`)
        .set(auth(teacher))
        .send({ score: 9, feedback: 'Well done', complete: true })
        .expect(200);

      const mine = await ctx
        .http()
        .get(`/api/v1/assignments/${id}`)
        .set(auth(learner))
        .expect(200);
      expect(mine.body.data.submission.status).toBe('completed');
      expect(mine.body.data.submission.score).toBe(9);
    });
  });

  describe('gamification cannot be farmed', () => {
    it('awards activity points only once', async () => {
      const learner = await register(ctx, 'learner');
      const course = await findCourse(ctx, 'yoruba', 'beginner');
      const outline = await ctx
        .http()
        .get(`/api/v1/courses/${course.id}`)
        .expect(200);
      const lessonId = outline.body.data.modules[0].lessons[0].id;
      const lesson = await ctx
        .http()
        .get(`/api/v1/learning/lessons/${lessonId}`)
        .set(auth(learner))
        .expect(200);
      const activity = lesson.body.data.activities[0];
      const submit = () =>
        ctx
          .http()
          .post(`/api/v1/learning/activities/${activity.id}/submit`)
          .set(auth(learner))
          .send({ response: activity.payload.choices[0] })
          .expect(200);
      await submit();
      const after1 = await ctx
        .http()
        .get('/api/v1/progress/stats')
        .set(auth(learner))
        .expect(200);
      await submit();
      await submit();
      const after3 = await ctx
        .http()
        .get('/api/v1/progress/stats')
        .set(auth(learner))
        .expect(200);
      expect(after3.body.data.totalPoints).toBe(after1.body.data.totalPoints);
      expect(after3.body.data.counters.activitiesCompleted).toBe(1);
    });

    it('rewards a GameCard scan once per card per day', async () => {
      const learner = await register(ctx, 'learner');
      const first = await ctx
        .http()
        .post('/api/v1/gamecard/scan')
        .set(auth(learner))
        .send({ code: 'yor-lion' })
        .expect(200);
      const second = await ctx
        .http()
        .post('/api/v1/gamecard/scan')
        .set(auth(learner))
        .send({ code: 'YOR-LION' })
        .expect(200);
      expect(first.body.data.rewarded).toBe(true);
      expect(second.body.data.rewarded).toBe(false);
      expect(first.body.data.card.translations).toHaveLength(3);
      expect(JSON.stringify(first.body.data)).not.toContain('"answer"');
    });
  });

  describe('input hardening', () => {
    it('handles regex metacharacters in search', async () => {
      await ctx.http().get('/api/v1/search?q=(((%5B*').expect(200);
    });

    it('returns 400 for malformed ids instead of 500', async () => {
      await ctx.http().get('/api/v1/courses/not-an-id').expect(400);
    });
  });
});
