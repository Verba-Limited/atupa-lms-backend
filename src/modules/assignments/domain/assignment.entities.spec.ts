import {
  assertLearnerTransition,
  assertReviewable,
  AssignmentStatus as S,
} from './assignment.entities';

describe('assignment status rules', () => {
  it('lets learners start and submit (and revise before review)', () => {
    expect(() => assertLearnerTransition(S.ASSIGNED, S.STARTED)).not.toThrow();
    expect(() => assertLearnerTransition(S.STARTED, S.SUBMITTED)).not.toThrow();
    expect(() =>
      assertLearnerTransition(S.SUBMITTED, S.SUBMITTED),
    ).not.toThrow();
  });

  it('never lets learners review, complete or change reviewed work', () => {
    expect(() => assertLearnerTransition(S.SUBMITTED, S.REVIEWED)).toThrow();
    expect(() => assertLearnerTransition(S.ASSIGNED, S.COMPLETED)).toThrow();
    expect(() => assertLearnerTransition(S.REVIEWED, S.SUBMITTED)).toThrow();
  });

  it('only reviews submitted work', () => {
    expect(() => assertReviewable(S.ASSIGNED)).toThrow();
    expect(() => assertReviewable(S.SUBMITTED)).not.toThrow();
  });
});
