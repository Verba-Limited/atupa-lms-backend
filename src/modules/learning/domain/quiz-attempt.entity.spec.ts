import { QuestionType, QuizQuestion } from '../../catalog';
import {
  gradeQuiz,
  isPastDeadline,
  remainingSeconds,
  shuffle,
  shuffleQuestionOrder,
  TIMER_GRACE_SECONDS,
} from './quiz-attempt.entity';

const q = (id: string, correctAnswer: string, points = 1): QuizQuestion => ({
  id,
  type: QuestionType.FILL_BLANK,
  prompt: id,
  correctAnswer,
  points,
});

describe('quiz grading', () => {
  it('grades by question id regardless of presentation order', () => {
    const questions = [q('q1', 'a'), q('q2', 'b'), q('q3', 'c', 2)];
    const result = gradeQuiz(questions, { q3: 'c', q1: 'a', q2: 'wrong' }, 70);
    expect(result.earnedPoints).toBe(3);
    expect(result.totalPoints).toBe(4);
    expect(result.scorePercent).toBe(75);
    expect(result.passed).toBe(true);
    expect(result.results.find((r) => r.questionId === 'q2')?.correct).toBe(
      false,
    );
  });

  it('fails below the pass mark', () => {
    expect(
      gradeQuiz([q('q1', 'a'), q('q2', 'b')], { q1: 'a' }, 70).passed,
    ).toBe(false);
  });

  it('allows a grace period after the timer', () => {
    const expiresAt = new Date('2026-10-15T10:00:00Z');
    expect(
      isPastDeadline(
        { expiresAt },
        new Date(expiresAt.getTime() + (TIMER_GRACE_SECONDS - 1) * 1000),
      ),
    ).toBe(false);
    expect(
      isPastDeadline(
        { expiresAt },
        new Date(expiresAt.getTime() + (TIMER_GRACE_SECONDS + 1) * 1000),
      ),
    ).toBe(true);
    expect(isPastDeadline({ expiresAt: undefined })).toBe(false);
  });

  it('shuffles without losing or duplicating questions', () => {
    const ids = ['a', 'b', 'c', 'd', 'e'];
    const shuffled = shuffle(ids, () => 0);
    expect([...shuffled].sort()).toEqual(ids);
    expect(shuffled).not.toEqual(ids);
  });

  it('never repeats the previous attempt order', () => {
    const ids = ['a', 'b'];
    for (let i = 0; i < 20; i++) {
      expect(shuffleQuestionOrder(ids, ['a', 'b'])).toEqual(['b', 'a']);
      expect(shuffleQuestionOrder(ids, ['b', 'a'])).toEqual(['a', 'b']);
    }
    const five = ['a', 'b', 'c', 'd', 'e'];
    const previous = shuffle(five, () => 0);
    const next = shuffleQuestionOrder(five, previous, () => 0);
    expect(next).not.toEqual(previous);
    expect([...next].sort()).toEqual(five);
    expect(shuffleQuestionOrder(['a'], ['a'])).toEqual(['a']);
  });

  it('reports remaining timer seconds', () => {
    const now = new Date('2026-10-15T10:00:00Z');
    const expiresAt = new Date(now.getTime() + 90_500);
    expect(remainingSeconds({ expiresAt }, now)).toBe(91);
    expect(
      remainingSeconds({ expiresAt }, new Date(now.getTime() + 999_000)),
    ).toBe(0);
    expect(remainingSeconds({ expiresAt: undefined }, now)).toBeNull();
  });
});
