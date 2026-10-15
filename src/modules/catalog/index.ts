// Public API of the catalog module.
export { CatalogModule } from './catalog.module';
export { CatalogQueryService } from './application/catalog-query.service';
export type {
  CourseOutline,
  CourseRequirements,
  LearnerLessonView,
} from './application/catalog-query.service';
export { CourseAuthoringService } from './application/course-authoring.service';
export { LanguagesService } from './application/languages.service';
export type { Course } from './domain/course.entity';
export { AgeGroup, CourseType } from './domain/course.entity';
export type { Lesson } from './domain/lesson.entity';
export { LessonBlockType } from './domain/lesson.entity';
export type { Activity } from './domain/activity.entity';
export {
  ActivityType,
  UNGRADED_ACTIVITY_TYPES,
} from './domain/activity.entity';
export type { Quiz, QuizQuestion, AnswerValue } from './domain/quiz.entity';
export { QuestionType, toLearnerQuestion } from './domain/quiz.entity';
export type { Language } from './domain/language.entity';
