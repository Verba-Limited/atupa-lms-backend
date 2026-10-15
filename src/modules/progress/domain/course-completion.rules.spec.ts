import { summarizeCourseProgress } from './course-completion.rules';

describe('course completion', () => {
  const req = { lessonIds: ['l1', 'l2', 'l3', 'l4'], quizIds: ['q1'] };

  it('reports percentage over lessons and quizzes', () => {
    const s = summarizeCourseProgress(
      req,
      new Set(['l1', 'l2', 'l3', 'l4']),
      new Set(),
    );
    expect(s).toMatchObject({
      percent: 80,
      complete: false,
      lessons: { completed: 4, total: 4 },
    });
  });

  it('is complete only when every lesson and quiz is done', () => {
    expect(
      summarizeCourseProgress(req, new Set(req.lessonIds), new Set(['q1']))
        .complete,
    ).toBe(true);
  });

  it('ignores progress on content no longer in the course', () => {
    expect(
      summarizeCourseProgress(req, new Set(['old']), new Set(['old-quiz']))
        .percent,
    ).toBe(0);
  });

  it('never marks an empty course complete', () => {
    expect(
      summarizeCourseProgress(
        { lessonIds: [], quizIds: [] },
        new Set(),
        new Set(),
      ).complete,
    ).toBe(false);
  });
});
