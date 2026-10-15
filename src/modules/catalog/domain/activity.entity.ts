export enum ActivityType {
  MATCHING = 'matching',
  MULTIPLE_CHOICE = 'multiple_choice',
  FILL_BLANK = 'fill_blank',
  DRAG_DROP = 'drag_drop',
  WORD_ARRANGEMENT = 'word_arrangement',
  LISTENING = 'listening',
  PRONUNCIATION_PRACTICE = 'pronunciation_practice',
  PICTURE_ID = 'picture_id',
  FLASHCARDS = 'flashcards',
}

/** Activities that are completed by doing them, not graded. */
export const UNGRADED_ACTIVITY_TYPES = [
  ActivityType.FLASHCARDS,
  ActivityType.PRONUNCIATION_PRACTICE,
];

export interface ActivityFeedback {
  correct?: string;
  incorrect?: string;
}

export interface Activity {
  id: string;
  courseId: string;
  lessonId: string;
  type: ActivityType;
  prompt?: string;
  /** Learner-visible content: choices, words, audio/image urls, cards... */
  payload: Record<string, unknown>;
  /** Hidden answer key. Never sent to learners. */
  solution?: unknown;
  /** Word arrangement etc.: answer order matters. */
  ordered?: boolean;
  feedback?: ActivityFeedback;
  order: number;
}

export type LearnerActivity = Omit<Activity, 'solution'>;

export function toLearnerActivity(activity: Activity): LearnerActivity {
  const { solution, ...rest } = activity;
  void solution;
  return rest;
}
