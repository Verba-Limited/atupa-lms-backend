import { adminSession, auth, register, Session } from './support/api';
import { createTestApp, TestContext } from './support/test-app';

/** Learners receive playable media wherever lessons use audio, video or images. */
describe('Learner media playback (e2e)', () => {
  let ctx: TestContext;
  let teacher: Session;
  let learner: Session;
  let audio: { id: string; url: string };
  let video: { id: string; url: string };
  let lessonId: string;
  let quizId: string;

  const upload = async (
    s: Session,
    name: string,
    type: string,
    purpose = 'content',
  ) => {
    const res = await ctx
      .http()
      .post('/api/v1/media/upload')
      .set(auth(s))
      .field('purpose', purpose)
      .attach('file', Buffer.from('test-media-bytes'), {
        filename: name,
        contentType: type,
      })
      .expect(201);
    return res.body.data as { id: string; url: string };
  };

  beforeAll(async () => {
    ctx = await createTestApp();
    teacher = await register(ctx, 'teacher');
    learner = await register(ctx, 'learner');
    const admin = await adminSession(ctx);
    audio = await upload(teacher, 'ekaaro.mp3', 'audio/mpeg');
    video = await upload(teacher, 'greetings.mp4', 'video/mp4');

    const vocab = await ctx
      .http()
      .post('/api/v1/authoring/vocabulary')
      .set(auth(admin))
      .send({
        languageCode: 'yoruba',
        term: 'Ẹ kú àárọ̀',
        meaning: 'Good morning',
        conceptKey: 'good_morning_media',
        audioUrl: audio.url,
      })
      .expect(201);

    const course = await ctx
      .http()
      .post('/api/v1/authoring/courses')
      .set(auth(teacher))
      .send({
        languageCode: 'yoruba',
        level: 'beginner',
        title: 'Media course',
      })
      .expect(201);
    const mod = await ctx
      .http()
      .post(`/api/v1/authoring/courses/${course.body.data.id}/modules`)
      .set(auth(teacher))
      .send({ title: 'Greetings' })
      .expect(201);

    // Attaching the wrong kind of file, or an unknown file, is rejected.
    await ctx
      .http()
      .post(`/api/v1/authoring/modules/${mod.body.data.id}/lessons`)
      .set(auth(teacher))
      .send({
        title: 'Bad',
        blocks: [{ type: 'video', mediaAssetId: audio.id }],
      })
      .expect(400);
    await ctx
      .http()
      .post(`/api/v1/authoring/modules/${mod.body.data.id}/lessons`)
      .set(auth(teacher))
      .send({
        title: 'Bad',
        blocks: [{ type: 'audio', mediaAssetId: '000000000000000000000000' }],
      })
      .expect(400);

    const lesson = await ctx
      .http()
      .post(`/api/v1/authoring/modules/${mod.body.data.id}/lessons`)
      .set(auth(teacher))
      .send({
        title: 'Morning greetings',
        blocks: [
          { type: 'audio', mediaAssetId: audio.id, content: 'Listen' },
          { type: 'video', mediaAssetId: video.id },
          { type: 'image', mediaUrl: 'https://example.com/elders.png' },
          { type: 'text', content: 'Greet elders first.' },
        ],
        vocabularyIds: [vocab.body.data.id],
      })
      .expect(201);
    lessonId = lesson.body.data.id;
    expect(lesson.body.data.blocks[0].mediaUrl).toBe(audio.url);

    await ctx
      .http()
      .post(`/api/v1/authoring/lessons/${lessonId}/activities`)
      .set(auth(teacher))
      .send({
        type: 'listening',
        payload: { audioUrl: audio.url, choices: ['Ẹ kú àárọ̀', 'Ẹ ṣé'] },
        solution: 'Ẹ kú àárọ̀',
      })
      .expect(201);
    const quiz = await ctx
      .http()
      .post(`/api/v1/authoring/courses/${course.body.data.id}/quizzes`)
      .set(auth(teacher))
      .send({
        lessonId,
        title: 'Listen and choose',
        questions: [
          {
            type: 'audio',
            prompt: 'What did you hear?',
            mediaUrl: audio.url,
            options: { choices: ['Ẹ kú àárọ̀', 'Ẹ ṣé'] },
            correctAnswer: 'Ẹ kú àárọ̀',
          },
        ],
      })
      .expect(201);
    quizId = quiz.body.data.id;
    await ctx
      .http()
      .post(`/api/v1/authoring/lessons/${lessonId}/publish`)
      .set(auth(teacher))
      .expect(200);
    await ctx
      .http()
      .post(`/api/v1/authoring/courses/${course.body.data.id}/publish`)
      .set(auth(teacher))
      .expect(200);
  }, 120_000);

  afterAll(() => ctx?.close());

  it('returns playable media in the learner lesson view', async () => {
    const res = await ctx
      .http()
      .get(`/api/v1/learning/lessons/${lessonId}`)
      .set(auth(learner))
      .expect(200);
    const { lesson, activities, vocabulary } = res.body.data;

    expect(lesson.blocks[0].media).toMatchObject({
      id: audio.id,
      kind: 'audio',
      sources: [{ type: 'audio/mpeg' }],
    });
    expect(lesson.blocks[1].media).toMatchObject({
      id: video.id,
      kind: 'video',
      sources: [{ type: 'video/mp4' }],
    });
    expect(lesson.blocks[2].media).toMatchObject({
      id: null,
      kind: 'image',
      url: 'https://example.com/elders.png',
    });
    expect(lesson.blocks[3].media).toBeNull();

    expect(vocabulary).toHaveLength(1);
    expect(vocabulary[0].audio).toMatchObject({ id: audio.id, kind: 'audio' });
    expect(activities[0].media).toEqual([
      expect.objectContaining({ id: audio.id }),
    ]);
    expect(JSON.stringify(res.body)).not.toContain('"solution"');
  });

  it('returns media on audio quiz questions', async () => {
    const res = await ctx
      .http()
      .post(`/api/v1/learning/quizzes/${quizId}/attempts`)
      .set(auth(learner))
      .expect(201);
    expect(res.body.data.questions[0].media).toMatchObject({
      id: audio.id,
      kind: 'audio',
    });
  });

  it('serves playback details to learners', async () => {
    const one = await ctx
      .http()
      .get(`/api/v1/media/${video.id}/playback`)
      .set(auth(learner))
      .expect(200);
    expect(one.body.data).toMatchObject({
      id: video.id,
      kind: 'video',
      url: video.url,
    });

    const many = await ctx
      .http()
      .post('/api/v1/media/playback')
      .set(auth(learner))
      .send({
        urls: [
          audio.url,
          'https://example.com/song.mp3',
          'https://example.com/page',
        ],
      })
      .expect(200);
    expect(many.body.data[audio.url]).toMatchObject({ id: audio.id });
    expect(many.body.data['https://example.com/song.mp3']).toMatchObject({
      id: null,
      kind: 'audio',
    });
    expect(many.body.data['https://example.com/page']).toBeUndefined();
  });

  it('keeps learner submissions private to the learner and staff', async () => {
    const recording = await upload(
      learner,
      'my-answer.mp3',
      'audio/mpeg',
      'submission',
    );
    const other = await register(ctx, 'learner');
    await ctx
      .http()
      .get(`/api/v1/media/${recording.id}/playback`)
      .set(auth(other))
      .expect(403);
    await ctx
      .http()
      .get(`/api/v1/media/${recording.id}/playback`)
      .set(auth(learner))
      .expect(200);
    await ctx
      .http()
      .get(`/api/v1/media/${recording.id}/playback`)
      .set(auth(teacher))
      .expect(200);
  });

  it('adds pronunciation audio to public vocabulary', async () => {
    const res = await ctx
      .http()
      .get('/api/v1/vocabulary/concepts/good_morning_media')
      .expect(200);
    expect(res.body.data[0].audio).toMatchObject({
      id: audio.id,
      sources: [{ type: 'audio/mpeg' }],
    });
  });
});
