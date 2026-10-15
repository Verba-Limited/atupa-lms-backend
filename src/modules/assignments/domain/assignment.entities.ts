import { ValidationError } from '../../../shared/domain/errors';

export enum AssignmentType {
  LESSON = 'lesson',
  QUIZ = 'quiz',
  VOCABULARY = 'vocabulary',
  AUDIO = 'audio',
  GAME = 'game',
  CULTURAL_RESEARCH = 'cultural_research',
  WRITTEN_WORK = 'written_work',
}

export enum AssignmentStatus {
  ASSIGNED = 'assigned',
  STARTED = 'started',
  SUBMITTED = 'submitted',
  REVIEWED = 'reviewed',
  COMPLETED = 'completed',
}

/** Types that complete themselves when the learner finishes the target. */
export const AUTO_COMPLETING_TYPES = [
  AssignmentType.LESSON,
  AssignmentType.QUIZ,
  AssignmentType.GAME,
];

/** Types that need a referenced lesson/quiz/game. */
export const TARGETED_TYPES = AUTO_COMPLETING_TYPES;

export interface Assignment {
  id: string;
  classroomId: string;
  schoolId: string | null;
  createdByUserId: string;
  title: string;
  instructions?: string;
  type: AssignmentType;
  /** Lesson, quiz or game id for targeted types. */
  targetId?: string;
  dueAt?: Date;
  maxScore?: number;
  learnerIds: string[];
  createdAt?: Date;
}

export interface Submission {
  id: string;
  assignmentId: string;
  classroomId: string;
  learnerId: string;
  status: AssignmentStatus;
  text?: string;
  mediaUrls: string[];
  score?: number;
  feedback?: string;
  startedAt?: Date;
  submittedAt?: Date;
  reviewedAt?: Date;
  reviewedByUserId?: string;
  completedAt?: Date;
  updatedAt?: Date;
}

const LEARNER_TRANSITIONS: Record<AssignmentStatus, AssignmentStatus[]> = {
  [AssignmentStatus.ASSIGNED]: [
    AssignmentStatus.STARTED,
    AssignmentStatus.SUBMITTED,
  ],
  [AssignmentStatus.STARTED]: [AssignmentStatus.SUBMITTED],
  // Learners may revise a submission until the teacher has reviewed it.
  [AssignmentStatus.SUBMITTED]: [AssignmentStatus.SUBMITTED],
  [AssignmentStatus.REVIEWED]: [],
  [AssignmentStatus.COMPLETED]: [],
};

export function assertLearnerTransition(
  from: AssignmentStatus,
  to: AssignmentStatus,
): void {
  if (!LEARNER_TRANSITIONS[from].includes(to)) {
    throw new ValidationError(
      `Cannot move an assignment from ${from} to ${to}`,
    );
  }
}

export function assertReviewable(status: AssignmentStatus): void {
  if (
    status === AssignmentStatus.ASSIGNED ||
    status === AssignmentStatus.STARTED
  ) {
    throw new ValidationError(
      'The learner has not submitted this assignment yet',
    );
  }
}
