import { CrudPort } from '../../../../shared/application/crud.port';
import {
  ContentStatus,
  ProficiencyLevel,
} from '../../../../shared/domain/enums';
import { Page, PageRequest } from '../../../../shared/domain/pagination';
import { Activity } from '../../domain/activity.entity';
import {
  AgeGroup,
  Course,
  CourseModule,
  CourseType,
} from '../../domain/course.entity';
import { Language } from '../../domain/language.entity';
import { Lesson } from '../../domain/lesson.entity';
import { Quiz } from '../../domain/quiz.entity';

export const LANGUAGE_REPOSITORY = Symbol('LANGUAGE_REPOSITORY');
export const COURSE_REPOSITORY = Symbol('COURSE_REPOSITORY');
export const MODULE_REPOSITORY = Symbol('MODULE_REPOSITORY');
export const LESSON_REPOSITORY = Symbol('LESSON_REPOSITORY');
export const ACTIVITY_REPOSITORY = Symbol('ACTIVITY_REPOSITORY');
export const QUIZ_REPOSITORY = Symbol('QUIZ_REPOSITORY');

export interface LanguageRepository extends CrudPort<Language> {
  findByCode(code: string): Promise<Language | null>;
  list(includeInactive: boolean): Promise<Language[]>;
}

export interface CourseFilter {
  languageCode?: string;
  level?: ProficiencyLevel;
  courseType?: CourseType;
  ageGroup?: AgeGroup;
  maxDurationMinutes?: number;
  isPremium?: boolean;
  status?: ContentStatus;
  createdByUserId?: string;
  schoolId?: string;
  q?: string;
  excludeIds?: string[];
}

export interface CourseRepository extends CrudPort<Course> {
  list(filter: CourseFilter, page: PageRequest): Promise<Page<Course>>;
  count(filter: CourseFilter): Promise<number>;
  countByLanguage(filter: CourseFilter): Promise<Record<string, number>>;
}

export interface ModuleRepository extends CrudPort<CourseModule> {
  listByCourse(courseId: string): Promise<CourseModule[]>;
  deleteByCourse(courseId: string): Promise<void>;
}

export interface LessonFilter {
  courseId?: string;
  moduleId?: string;
  status?: ContentStatus;
  q?: string;
  gamecardCode?: string;
  courseIds?: string[];
}

export interface LessonRepository extends CrudPort<Lesson> {
  list(filter: LessonFilter, limit?: number): Promise<Lesson[]>;
  deleteMany(filter: LessonFilter): Promise<void>;
}

export interface ActivityRepository extends CrudPort<Activity> {
  listByLessons(lessonIds: string[]): Promise<Activity[]>;
  deleteByLessons(lessonIds: string[]): Promise<void>;
}

export interface QuizRepository extends CrudPort<Quiz> {
  listByCourse(courseId: string): Promise<Quiz[]>;
  listByLessons(lessonIds: string[]): Promise<Quiz[]>;
  deleteMany(filter: {
    courseId?: string;
    moduleId?: string;
    lessonIds?: string[];
  }): Promise<void>;
}
