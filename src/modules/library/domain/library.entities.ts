import { ContentStatus, ProficiencyLevel } from '../../../shared/domain/enums';

/** One word/phrase in one language. `conceptKey` links translations. */
export interface VocabularyEntry {
  id: string;
  languageCode: string;
  term: string;
  /** English meaning. */
  meaning: string;
  /** Shared key across languages, e.g. "lion" (Kiniun / Ọdụm / Zaki). */
  conceptKey: string;
  pronunciation?: string;
  audioUrl?: string;
  imageUrl?: string;
  exampleSentence?: string;
  exampleTranslation?: string;
  category?: string;
  level?: ProficiencyLevel;
  tags: string[];
  status: ContentStatus;
  createdAt?: Date;
}

export enum CulturalCategory {
  GREETINGS = 'traditional_greetings',
  FOOD = 'food',
  CLOTHING = 'clothing',
  MUSIC = 'music',
  FESTIVALS = 'festivals',
  NAMES = 'names',
  PROVERBS = 'proverbs',
  FOLKLORE = 'folklore',
  HISTORY = 'history',
  OCCUPATIONS = 'traditional_occupations',
  ARTS_AND_CRAFTS = 'arts_and_crafts',
  SOCIAL_CUSTOMS = 'social_customs',
}

export interface CulturalBlock {
  type: 'text' | 'image' | 'audio' | 'video';
  content?: string;
  mediaUrl?: string;
}

export interface CulturalTopic {
  id: string;
  title: string;
  category: CulturalCategory;
  /** Optional: a topic can be pan-Nigerian. */
  languageCode?: string;
  summary?: string;
  blocks: CulturalBlock[];
  /** Optional linked quiz / activity in the catalog. */
  quizId?: string;
  ageGroup?: string;
  tags: string[];
  status: ContentStatus;
  createdAt?: Date;
}

export enum GameType {
  CARD = 'card',
  MOBILE = 'mobile',
  WEB = 'web',
}

export interface Game {
  id: string;
  title: string;
  description?: string;
  gameType: GameType;
  languageCodes: string[];
  /** Deep link / URL that launches the game when an integration exists. */
  launchUrl?: string;
  coverImageUrl?: string;
  /** Vocabulary concepts the game practises. */
  conceptKeys: string[];
  isPremium: boolean;
  status: ContentStatus;
  createdAt?: Date;
}
