export enum NotificationType {
  NEW_COURSE = 'new_course',
  NEW_GAME = 'new_game',
  ASSIGNMENT = 'assignment',
  ASSIGNMENT_FEEDBACK = 'assignment_feedback',
  QUIZ_RESULT = 'quiz_result',
  COURSE_COMPLETED = 'course_completed',
  CERTIFICATE = 'certificate',
  BADGE = 'badge',
  ANNOUNCEMENT = 'announcement',
  REMINDER = 'reminder',
  SUBSCRIPTION = 'subscription',
}

export interface InAppNotification {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  /** Deep-link data for the frontend, e.g. { courseId }. */
  data?: Record<string, string>;
  readAt?: Date | null;
  createdAt?: Date;
}

export type NewNotification = Omit<
  InAppNotification,
  'id' | 'readAt' | 'createdAt'
>;
