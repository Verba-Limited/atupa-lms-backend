import { auth, findCourse, register, Session } from './support/api';
import { createTestApp, TestContext } from './support/test-app';

/**
 * PRD section 35 learner flow: register -> select language/level -> start
 * course -> complete lessons -> take quiz -> earn points/badges -> complete
 * course -> receive certificate; parent is notified along the way.
 */
describe('Learner journey (e2e)', () => {
  let ctx: TestContext;
  let learner: Session;
  let parent: Session;

  beforeAll(async () => {
    ctx = await createTestApp();
    learner = await register(ctx, 'learner');
    parent = await register(ctx, 'parent');
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
  }, 120_000);

  afterAll(() => ctx?.close());

  it('completes a course and receives a verifiable certificate', async () => {
    const course = await findCourse(ctx, 'yoruba', 'beginner');
    await ctx
      .http()
      .post(`/api/v1/progress/courses/${course.id}/enroll`)
      .set(auth(learner))
      .expect(201);
    const outline = (
      await ctx.http().get(`/api/v1/courses/${course.id}`).expect(200)
    ).body.data;

    const lessonIds: string[] = outline.modules.flatMap(
      (m: { lessons: { id: string }[] }) => m.lessons.map((l) => l.id),
    );
    expect(lessonIds.length).toBe(2);

    // Resume position is saved for "continue where I stopped".
    await ctx
      .http()
      .put(`/api/v1/progress/lessons/${lessonIds[0]}/position`)
      .set(auth(learner))
      .send({ lastBlockIndex: 1, progressPercent: 50 })
      .expect(200);
    const cont = await ctx
      .http()
      .get('/api/v1/progress/continue')
      .set(auth(learner))
      .expect(200);
    expect(cont.body.data.lessonId).toBe(lessonIds[0]);
    expect(cont.body.data.lastBlockIndex).toBe(1);

    for (const id of lessonIds) {
      await ctx
        .http()
        .post(`/api/v1/progress/lessons/${id}/complete`)
        .set(auth(learner))
        .expect(200);
    }
    let progress = await ctx
      .http()
      .get(`/api/v1/progress/courses/${course.id}`)
      .set(auth(learner))
      .expect(200);
    expect(progress.body.data.complete).toBe(false);

    // Take the quiz; tone marks are optional for typed answers.
    const quizId = outline.modules[0].quizzes[0].id;
    const attempt = (
      await ctx
        .http()
        .post(`/api/v1/learning/quizzes/${quizId}/attempts`)
        .set(auth(learner))
        .expect(201)
    ).body.data;
    const answers: Record<string, string> = {};
    for (const q of attempt.questions) {
      answers[q.id] = q.type === 'translation' ? 'e se' : q.options.choices[0];
    }
    const result = await ctx
      .http()
      .post(`/api/v1/learning/attempts/${attempt.attemptId}/submit`)
      .set(auth(learner))
      .send({ answers })
      .expect(200);
    expect(result.body.data.passed).toBe(true);

    const review = await ctx
      .http()
      .get(`/api/v1/learning/attempts/${attempt.attemptId}/review`)
      .set(auth(learner))
      .expect(200);
    expect(review.body.data.questions[0]).toHaveProperty('correctAnswer');

    progress = await ctx
      .http()
      .get(`/api/v1/progress/courses/${course.id}`)
      .set(auth(learner))
      .expect(200);
    expect(progress.body.data.complete).toBe(true);
    expect(progress.body.data.percent).toBe(100);

    // Certificate issued automatically, with the learner's real name.
    const certs = await ctx
      .http()
      .get('/api/v1/certificates/mine')
      .set(auth(learner))
      .expect(200);
    expect(certs.body.data).toHaveLength(1);
    const cert = certs.body.data[0];
    expect(cert.learnerName).toBe('Ada Obi');
    expect(cert.qrCodeDataUrl).toMatch(/^data:image\/png;base64,/);

    const verify = await ctx
      .http()
      .get(`/api/v1/certificates/verify/${cert.verificationCode}`)
      .expect(200);
    expect(verify.body.data).toMatchObject({
      valid: true,
      courseTitle: course.title,
      language: 'Yoruba',
    });

    // Points, badges and dashboard.
    const dashboard = await ctx
      .http()
      .get('/api/v1/dashboards/learner')
      .set(auth(learner))
      .expect(200);
    const d = dashboard.body.data;
    expect(d.welcomeMessage).toBe('Welcome, Ada!');
    expect(d.points).toBeGreaterThan(0);
    expect(d.badges.map((b: { code: string }) => b.code)).toEqual(
      expect.arrayContaining(['first_lesson', 'course_graduate']),
    );
    expect(d.certificates).toHaveLength(1);
    expect(d.streakDays).toBe(1);
    expect(d.recommendedCourses.length).toBeGreaterThan(0);

    // Parent sees the child's progress and got notified.
    const child = await ctx
      .http()
      .get(`/api/v1/dashboards/children/${learner.userId}`)
      .set(auth(parent))
      .expect(200);
    expect(child.body.data.certificates).toHaveLength(1);
    const notes = await ctx
      .http()
      .get('/api/v1/notifications')
      .set(auth(parent))
      .expect(200);
    const titles = notes.body.data.items.map((n: { title: string }) => n.title);
    expect(titles).toEqual(
      expect.arrayContaining(['Course completed', 'New certificate']),
    );
  });
});
