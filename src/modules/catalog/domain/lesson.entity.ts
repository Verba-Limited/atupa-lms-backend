import { ContentStatus } from '../../../shared/domain/enums';

export enum LessonBlockType {
  TEXT = 'text',
  IMAGE = 'image',
  AUDIO = 'audio',
  VIDEO = 'video',
  FLASHCARDS = 'flashcards',
  VOCABULARY = 'vocabulary',
  PRONUNCIATION = 'pronunciation',
  CULTURAL_NOTE = 'cultural_note',
  GAME = 'game',
  ACTIVITY = 'activity',
  QUIZ = 'quiz',
}

export interface LessonBlock {
  type: LessonBlockType;
  /** Text/markdown body or caption. */
  content?: string;
  mediaUrl?: string;
  mediaAssetId?: string;
  /** Reference to an activity, quiz, game or vocabulary entry. */
  refId?: string;
  /** Free-form structured data (e.g. flashcards). */
  data?: Record<string, unknown>;
}

export interface Lesson {
  id: string;
  courseId: string;
  moduleId: string;
  title: string;
  summary?: string;
  blocks: LessonBlock[];
  /** Quick keywords (also used by search). */
  vocabulary: string[];
  /** Linked entries in the vocabulary library. */
  vocabularyIds: string[];
  pronunciationNotes: string[];
  culturalNotes: string[];
  /** ATUPA GameCard codes this lesson links to. */
  gamecardCodes: string[];
  estimatedMinutes?: number;
  status: ContentStatus;
  order: number;
  createdAt?: Date;
  updatedAt?: Date;
}
