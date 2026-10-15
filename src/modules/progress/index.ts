// Public API of the progress module.
export { ProgressModule } from './progress.module';
export { ProgressService } from './application/progress.service';
export { ProgressQueryService } from './application/progress-query.service';
export type {
  CourseProgressView,
  LearnerStatsView,
} from './application/progress-query.service';
export type {
  Enrollment,
  LearningEvent,
  QuizResult,
} from './domain/progress.entities';
export { LearningEventType } from './domain/progress.entities';
export { BADGES, badgeName } from './domain/gamification.rules';
