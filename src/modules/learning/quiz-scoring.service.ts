import { Injectable } from '@nestjs/common';
import { QuizQuestion } from '../catalog/schemas/quiz.schema';

export interface QuizAnswerMap {
  [questionIndex: string]: string | string[] | Record<string, string>;
}

export interface QuizScoreResult {
  scorePercent: number;
  passed: boolean;
  correctCount: number;
  totalQuestions: number;
  feedback: Array<{ questionIndex: number; correct: boolean }>;
}

@Injectable()
export class QuizScoringService {
  scoreAttempt(
    questions: QuizQuestion[],
    answers: QuizAnswerMap,
    passScorePercent: number,
  ): QuizScoreResult {
    const feedback = questions.map((question, index) => ({
      questionIndex: index,
      correct: this.isAnswerCorrect(question.correctAnswer, answers[String(index)]),
    }));
    const correctCount = feedback.filter((item) => item.correct).length;
    const totalQuestions = questions.length || 1;
    const scorePercent = Math.round((correctCount / totalQuestions) * 100);
    return {
      scorePercent,
      passed: scorePercent >= passScorePercent,
      correctCount,
      totalQuestions,
      feedback,
    };
  }

  private isAnswerCorrect(
    expected: string | string[] | Record<string, string>,
    actual?: string | string[] | Record<string, string>,
  ): boolean {
    if (actual === undefined) return false;
    if (typeof expected === 'string') {
      return String(actual).trim().toLowerCase() === expected.trim().toLowerCase();
    }
    if (Array.isArray(expected)) {
      if (!Array.isArray(actual)) return false;
      const normalizedExpected = [...expected].map((v) => v.toLowerCase()).sort();
      const normalizedActual = [...actual].map((v) => String(v).toLowerCase()).sort();
      return JSON.stringify(normalizedExpected) === JSON.stringify(normalizedActual);
    }
    if (typeof actual !== 'object' || actual === null || Array.isArray(actual)) {
      return false;
    }
    const actualRecord = actual as Record<string, string>;
    return Object.keys(expected).every(
      (key) =>
        expected[key]?.toLowerCase() ===
        String(actualRecord[key]).toLowerCase(),
    );
  }
}
