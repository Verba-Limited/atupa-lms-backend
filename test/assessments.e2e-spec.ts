import { QuizAttemptsService } from '../src/modules/learning/application/quiz-attempts.service';
import { TIMER_GRACE_SECONDS } from '../src/modules/learning/domain/quiz-attempt.entity';
import { auth, register, Session } from './support/api';
import { createTestApp, TestContext } from './support/test-app';

/** Image/audio questions, timers and randomised order (US-07). */
describe('Assessments (e2e)', () => {
  let ctx: TestContext;
  let teacher: Session;
  let courseId: string;
  let lessonId: string;
  let image: { id: string; url: string };
  let audio: { id: string; url: string };

  const upload = async (name: string, type: string) => {
    const res = await ctx
      .http()
      .post('/api/v1/media/upload')
      .set(auth(teacher))
      .field('purpose', 'content')
      .attach('file', Buffer.from('test-media-bytes'), {
        filename: name,
        contentType: type,
      })
      .expect(201);
    return res.body.data as { id: string; url: string };
  };

  const createQuiz = async (body: Record<string, unknown>, status = 201) => {
    const res = await ctx
      .http()
      .post(`/api/v1/authoring/courses/${courseId}/quizzes`)
      .set(auth(teacher))
      .send({ lessonId, title: 'Quiz', ...body })
      .expect(status);
    return res.body.data;
  };

  const choice = (id: string, extra: Record<string, unknown> = {}) => ({
    id,
    type: 'multiple_choice',
    prompt: id,
    options: { choices: ['yes', 'no'] },
    correctAnswer: 'yes',
    ...extra,
  });

  const start = async (learner: Session, quizId: string) =>
    (
      await ctx
        .http()
        .post(`/api/v1/learning/quizzes/${quizId}/attempts`)
        .set(auth(learner))
        .expect(201)
    ).body.data;

  const submit = async (
    learner: Session,
    attemptId: string,
    answers: Record<string, unknown>,
  ) =>
    (
      await ctx
        .http()
        .post(`/api/v1/learning/attempts/${attemptId}/submit`)
        .set(auth(learner))
        .send({ answers })
        .expect(200)
    ).body.data;

  beforeAll(async () => {
    ctx = await createTestApp();
    teacher = await register(ctx, 'teacher');
    image = await upload('lion.png', 'image/png');
    audio = await upload('ekaaro.mp3', 'audio/mpeg');
    const course = await ctx
      .http()
      .post('/api/v1/authoring/courses')
      .set(auth(teacher))
      .send({ languageCode: 'yoruba', level: 'beginner', title: 'Quiz course' })
      .expect(201);
    courseId = course.body.data.id;
    const mod = await ctx
      .http()
      .post(`/api/v1/authoring/courses/${courseId}/modules`)
      .set(auth(teacher))
      .send({ title: 'Animals' })
      .expect(201);
    const lesson = await ctx
      .http()
      .post(`/api/v1/authoring/modules/${mod.body.data.id}/lessons`)
      .set(auth(teacher))
      .send({ title: 'Animals', blocks: [{ type: 'text', content: 'Hi' }] })
      .expect(201);
    lessonId = lesson.body.data.id;
    await ctx
      .http()
      .post(`/api/v1/authoring/lessons/${lessonId}/publish`)
      .set(auth(teacher))
      .expect(200);
    await ctx
      .http()
      .post(`/api/v1/authoring/courses/${courseId}/publish`)
      .set(auth(teacher))
      .expect(200);
  }, 120_000);

  afterAll(() => ctx?.close());

  describe('image and audio questions', () => {
    it('accepts uploaded files by mediaAssetId and checks their kind', async () => {
      await createQuiz(
        {
          questions: [
            {
              type: 'image',
              prompt: 'Which animal?',
              mediaAssetId: audio.id,
              options: { choices: ['Kìnnìún', 'Ajá'] },
              correctAnswer: 'Kìnnìún',
            },
          ],
        },
        400,
      );

      const quiz = await createQuiz({
        questions: [
          {
            id: 'img',
            type: 'image',
            prompt: 'Which animal?',
            mediaAssetId: image.id,
            options: { choices: ['Kìnnìún', 'Ajá'] },
            correctAnswer: 'Kìnnìún',
          },
          {
            id: 'aud',
            type: 'audio',
            prompt: 'What did you hear?',
            mediaAssetId: audio.id,
            options: { choices: ['Ẹ kú àárọ̀', 'Ẹ ṣé'] },
            correctAnswer: 'Ẹ kú àárọ̀',
          },
        ],
      });
      expect(quiz.questions[0].mediaUrl).toBe(image.url);
      expect(quiz.questions[1].mediaUrl).toBe(audio.url);

      const learner = await register(ctx, 'learner');
      const attempt = await start(learner, quiz.id);
      const [img, aud] = attempt.questions;
      expect(img).toMatchObject({
        type: 'image',
        options: { choices: ['Kìnnìún', 'Ajá'] },
        media: { id: image.id, kind: 'image' },
      });
      expect(aud).toMatchObject({
        type: 'audio',
        media: {
          id: audio.id,
          kind: 'audio',
          sources: [{ type: 'audio/mpeg' }],
        },
      });
      expect(JSON.stringify(attempt)).not.toContain('correctAnswer');

      const result = await submit(learner, attempt.attemptId, {
        img: 'Kìnnìún',
        aud: 'Ẹ ṣé',
      });
      expect(result).toMatchObject({
        status: 'submitted',
        correctCount: 1,
        scorePercent: 50,
        results: [
          { questionId: 'img', correct: true },
          { questionId: 'aud', correct: false },
        ],
      });
    });
  });

  describe('timer', () => {
    it('reports time remaining and records abandoned attempts as expired', async () => {
      const quiz = await createQuiz({
        timerSeconds: 60,
        maxAttempts: 2,
        questions: [choice('q1')],
      });
      const learner = await register(ctx, 'learner');
      const attempt = await start(learner, quiz.id);
      expect(attempt.remainingSeconds).toBeGreaterThan(55);
      expect(attempt.remainingSeconds).toBeLessThanOrEqual(60);
      expect(attempt.serverTime).toBeDefined();

      // The learner closes the app; the background job runs after the deadline.
      const later = new Date(
        Date.now() + (60 + TIMER_GRACE_SECONDS + 1) * 1000,
      );
      const expired = await ctx.app
        .get(QuizAttemptsService)
        .expireOverdue(later);
      expect(expired).toBeGreaterThanOrEqual(1);

      const mine = await ctx
        .http()
        .get(`/api/v1/learning/attempts?quizId=${quiz.id}`)
        .set(auth(learner))
        .expect(200);
      expect(mine.body.data).toEqual([
        expect.objectContaining({
          id: attempt.attemptId,
          status: 'expired',
          scorePercent: 0,
          passed: false,
        }),
      ]);

      // Submitting the closed attempt is refused; it used one of two attempts.
      await ctx
        .http()
        .post(`/api/v1/learning/attempts/${attempt.attemptId}/submit`)
        .set(auth(learner))
        .send({ answers: { q1: 'yes' } })
        .expect(400);
      const second = await start(learner, quiz.id);
      expect(second.attemptId).not.toBe(attempt.attemptId);
      await submit(learner, second.attemptId, { q1: 'yes' });
      await ctx
        .http()
        .post(`/api/v1/learning/quizzes/${quiz.id}/attempts`)
        .set(auth(learner))
        .expect(403);
    });

    it('leaves running attempts alone', async () => {
      const quiz = await createQuiz({
        timerSeconds: 600,
        questions: [choice('q1')],
      });
      const learner = await register(ctx, 'learner');
      const attempt = await start(learner, quiz.id);
      await ctx.app.get(QuizAttemptsService).expireOverdue();
      const result = await submit(learner, attempt.attemptId, { q1: 'yes' });
      expect(result).toMatchObject({ status: 'submitted', timedOut: false });
    });
  });

  describe('randomised order', () => {
    it('gives each fresh attempt a different order', async () => {
      const quiz = await createQuiz({
        randomizeQuestions: true,
        questions: [choice('a'), choice('b')],
      });
      const learner = await register(ctx, 'learner');
      const orders: string[] = [];
      for (let i = 0; i < 4; i++) {
        const attempt = await start(learner, quiz.id);
        orders.push(
          attempt.questions.map((q: { id: string }) => q.id).join(','),
        );
        const result = await submit(learner, attempt.attemptId, {
          a: 'yes',
          b: 'yes',
        });
        expect(result.scorePercent).toBe(100);
      }
      for (let i = 1; i < orders.length; i++) {
        expect(orders[i]).not.toBe(orders[i - 1]);
      }
    });

    it('keeps author order when randomising is off', async () => {
      const quiz = await createQuiz({
        questions: [choice('a'), choice('b'), choice('c')],
      });
      const learner = await register(ctx, 'learner');
      const attempt = await start(learner, quiz.id);
      expect(attempt.questions.map((q: { id: string }) => q.id)).toEqual([
        'a',
        'b',
        'c',
      ]);
    });
  });
});
