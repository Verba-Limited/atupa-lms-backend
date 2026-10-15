export interface CardChallenge {
  prompt: string;
  choices?: string[];
  answer: string;
  explanation?: string;
}

/** A physical ATUPA GameCard. Its QR encodes a link containing `code`. */
export interface GameCard {
  id: string;
  /** Printed/QR code, e.g. "YOR-LION". Uppercase, unique. */
  code: string;
  /** Vocabulary concept this card teaches, e.g. "lion". */
  conceptKey: string;
  languageCode: string;
  title: string;
  description?: string;
  imageUrl?: string;
  challenge?: CardChallenge;
  isActive: boolean;
}

export type LearnerCardChallenge = Omit<
  CardChallenge,
  'answer' | 'explanation'
>;

export function toLearnerChallenge(
  challenge?: CardChallenge,
): LearnerCardChallenge | undefined {
  if (!challenge) return undefined;
  return { prompt: challenge.prompt, choices: challenge.choices };
}

export function normalizeCardCode(code: string): string {
  return code.trim().toUpperCase();
}

export type PlayKind = 'scan' | 'challenge' | 'game';

/** One scan / challenge / game session. `day` keys the once-a-day reward. */
export interface PlayRecord {
  id: string;
  userId: string;
  kind: PlayKind;
  /** Card code or game id. */
  ref: string;
  languageCode?: string;
  correct?: boolean;
  scorePercent?: number;
  durationSeconds?: number;
  rewarded: boolean;
  day: string;
  at: Date;
}
