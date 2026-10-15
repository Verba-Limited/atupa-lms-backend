import { ValidationError } from '../../../shared/domain/errors';

export enum QuestionType {
  MULTIPLE_CHOICE = 'multiple_choice',
  TRUE_FALSE = 'true_false',
  MATCHING = 'matching',
  FILL_BLANK = 'fill_blank',
  IMAGE = 'image',
  AUDIO = 'audio',
  TRANSLATION = 'translation',
  VOCABULARY = 'vocabulary',
}

export type AnswerValue = string | string[] | Record<string, string>;

export interface QuizQuestion {
  id: string;
  type: QuestionType;
  prompt: string;
  mediaUrl?: string;
  /** Learner-visible options, e.g. { choices: [...] } or { left, right }. */
  options?: Record<string, unknown>;
  correctAnswer: AnswerValue;
  /** Extra accepted spellings for free-text answers. */
  acceptedAnswers?: string[];
  /** For array answers: whether order matters. */
  ordered?: boolean;
  explanation?: string;
  points: number;
}

export interface Quiz {
  id: string;
  courseId: string;
  moduleId?: string;
  lessonId?: string;
  title: string;
  description?: string;
  questions: QuizQuestion[];
  passScorePercent: number;
  timerSeconds?: number;
  randomizeQuestions: boolean;
  /** Undefined = unlimited attempts. */
  maxAttempts?: number;
  /** Whether learners can see correct answers after submitting. */
  allowReview: boolean;
}

export type LearnerQuestion = Omit<
  QuizQuestion,
  'correctAnswer' | 'acceptedAnswers' | 'explanation'
>;

export function toLearnerQuestion(question: QuizQuestion): LearnerQuestion {
  const { correctAnswer, acceptedAnswers, explanation, ...rest } = question;
  void correctAnswer;
  void acceptedAnswers;
  void explanation;
  return rest;
}

export interface QuizSummary {
  id: string;
  courseId: string;
  moduleId?: string;
  lessonId?: string;
  title: string;
  description?: string;
  questionCount: number;
  passScorePercent: number;
  timerSeconds?: number;
  maxAttempts?: number;
}

export function toQuizSummary(quiz: Quiz): QuizSummary {
  return {
    id: quiz.id,
    courseId: quiz.courseId,
    moduleId: quiz.moduleId,
    lessonId: quiz.lessonId,
    title: quiz.title,
    description: quiz.description,
    questionCount: quiz.questions.length,
    passScorePercent: quiz.passScorePercent,
    timerSeconds: quiz.timerSeconds,
    maxAttempts: quiz.maxAttempts,
  };
}

const CHOICE_TYPES = [
  QuestionType.MULTIPLE_CHOICE,
  QuestionType.IMAGE,
  QuestionType.AUDIO,
  QuestionType.VOCABULARY,
];

/** Checks that each question's answer key fits its type. */
export function assertValidQuestions(questions: QuizQuestion[]): void {
  if (!questions.length) {
    throw new ValidationError('A quiz needs at least one question');
  }
  questions.forEach((q, index) => {
    const label = `Question ${index + 1}`;
    const answer = q.correctAnswer;
    if (CHOICE_TYPES.includes(q.type)) {
      const choices = q.options?.choices;
      if (!Array.isArray(choices) || choices.length < 2) {
        throw new ValidationError(`${label}: options.choices needs 2+ items`);
      }
      const keys = Array.isArray(answer) ? answer : [answer];
      if (!keys.every((k) => typeof k === 'string' && choices.includes(k))) {
        throw new ValidationError(
          `${label}: correctAnswer must be one of the choices`,
        );
      }
    } else if (q.type === QuestionType.TRUE_FALSE) {
      if (answer !== 'true' && answer !== 'false') {
        throw new ValidationError(
          `${label}: correctAnswer must be "true" or "false"`,
        );
      }
    } else if (q.type === QuestionType.MATCHING) {
      if (
        typeof answer !== 'object' ||
        Array.isArray(answer) ||
        Object.keys(answer).length < 2
      ) {
        throw new ValidationError(
          `${label}: matching needs a { left: right } map with 2+ pairs`,
        );
      }
    } else if (typeof answer !== 'string' && !Array.isArray(answer)) {
      throw new ValidationError(`${label}: correctAnswer must be text`);
    }
    if (
      (q.type === QuestionType.IMAGE || q.type === QuestionType.AUDIO) &&
      !q.mediaUrl
    ) {
      throw new ValidationError(
        `${label}: ${q.type} questions need a mediaUrl`,
      );
    }
  });
}
