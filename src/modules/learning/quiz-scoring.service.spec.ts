import { QuizScoringService } from './quiz-scoring.service';

describe('QuizScoringService', () => {
  const service = new QuizScoringService();

  it('scores multiple choice answers', () => {
    const result = service.scoreAttempt(
      [
        {
          type: 'multiple_choice',
          prompt: 'Pick A',
          options: { choices: ['A', 'B'] },
          correctAnswer: 'A',
        },
      ],
      { '0': 'A' },
      70,
    );
    expect(result.scorePercent).toBe(100);
    expect(result.passed).toBe(true);
  });

  it('fails when below pass threshold', () => {
    const result = service.scoreAttempt(
      [
        {
          type: 'multiple_choice',
          prompt: 'Pick A',
          options: { choices: ['A', 'B'] },
          correctAnswer: 'A',
        },
        {
          type: 'true_false',
          prompt: 'True?',
          options: { choices: ['true', 'false'] },
          correctAnswer: 'true',
        },
      ],
      { '0': 'B', '1': 'true' },
      70,
    );
    expect(result.scorePercent).toBe(50);
    expect(result.passed).toBe(false);
  });
});
