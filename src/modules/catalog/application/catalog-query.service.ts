import { Inject, Injectable } from '@nestjs/common';
import { ContentStatus } from '../../../shared/domain/enums';
import { NotFoundError } from '../../../shared/domain/errors';
import { Page, PageRequest } from '../../../shared/domain/pagination';
import {
  Activity,
  LearnerActivity,
  toLearnerActivity,
} from '../domain/activity.entity';
import { Course, CourseModule } from '../domain/course.entity';
import { Language } from '../domain/language.entity';
import { Lesson } from '../domain/lesson.entity';
import { Quiz, QuizSummary, toQuizSummary } from '../domain/quiz.entity';
import type {
  ActivityRepository,
  CourseFilter,
  CourseRepository,
  LanguageRepository,
  LessonFilter,
  LessonRepository,
  ModuleRepository,
  QuizRepository,
} from './ports/catalog.repositories.port';
import {
  ACTIVITY_REPOSITORY,
  COURSE_REPOSITORY,
  LANGUAGE_REPOSITORY,
  LESSON_REPOSITORY,
  MODULE_REPOSITORY,
  QUIZ_REPOSITORY,
} from './ports/catalog.repositories.port';

export type LessonSummary = Pick<
  Lesson,
  | 'id'
  | 'courseId'
  | 'moduleId'
  | 'title'
  | 'summary'
  | 'estimatedMinutes'
  | 'order'
>;

export interface CourseOutline {
  course: Course;
  modules: Array<
    CourseModule & { lessons: LessonSummary[]; quizzes: QuizSummary[] }
  >;
  courseQuizzes: QuizSummary[];
  totals: { lessons: number; quizzes: number; activities: number };
}

export interface LearnerLessonView {
  lesson: Lesson;
  course: Course;
  activities: LearnerActivity[];
  quizzes: QuizSummary[];
}

/** What a learner must finish to complete a course. */
export interface CourseRequirements {
  courseId: string;
  lessonIds: string[];
  quizIds: string[];
  activityIds: string[];
}

function toLessonSummary(lesson: Lesson): LessonSummary {
  return {
    id: lesson.id,
    courseId: lesson.courseId,
    moduleId: lesson.moduleId,
    title: lesson.title,
    summary: lesson.summary,
    estimatedMinutes: lesson.estimatedMinutes,
    order: lesson.order,
  };
}

/**
 * Read-side facade of the catalog. Everything returned to learners is
 * published content with answer keys removed. Methods suffixed
 * `ForGrading` include answer keys and are for other modules only.
 */
@Injectable()
export class CatalogQueryService {
  constructor(
    @Inject(LANGUAGE_REPOSITORY) private readonly languages: LanguageRepository,
    @Inject(COURSE_REPOSITORY) private readonly courses: CourseRepository,
    @Inject(MODULE_REPOSITORY) private readonly modules: ModuleRepository,
    @Inject(LESSON_REPOSITORY) private readonly lessons: LessonRepository,
    @Inject(ACTIVITY_REPOSITORY)
    private readonly activities: ActivityRepository,
    @Inject(QUIZ_REPOSITORY) private readonly quizzes: QuizRepository,
  ) {}

  listLanguages(includeInactive = false): Promise<Language[]> {
    return this.languages.list(includeInactive);
  }

  findLanguage(code: string): Promise<Language | null> {
    return this.languages.findByCode(code);
  }

  listPublishedCourses(
    filter: CourseFilter,
    page: PageRequest,
  ): Promise<Page<Course>> {
    return this.courses.list(
      { ...filter, status: ContentStatus.PUBLISHED },
      page,
    );
  }

  async getPublishedCourse(courseId: string): Promise<Course> {
    const course = await this.courses.findById(courseId);
    if (!course || course.status !== ContentStatus.PUBLISHED) {
      throw new NotFoundError('Course not found');
    }
    return course;
  }

  findCourse(courseId: string): Promise<Course | null> {
    return this.courses.findById(courseId);
  }

  findCourses(courseIds: string[]): Promise<Course[]> {
    return this.courses.findByIds(courseIds);
  }

  findLessons(lessonIds: string[]): Promise<Lesson[]> {
    return this.lessons.findByIds(lessonIds);
  }

  findQuizzes(quizIds: string[]): Promise<Quiz[]> {
    return this.quizzes.findByIds(quizIds);
  }

  async getCourseOutline(courseId: string): Promise<CourseOutline> {
    const course = await this.getPublishedCourse(courseId);
    const [modules, lessons, quizzes] = await Promise.all([
      this.modules.listByCourse(courseId),
      this.lessons.list({ courseId, status: ContentStatus.PUBLISHED }),
      this.quizzes.listByCourse(courseId),
    ]);
    const lessonIds = new Set(lessons.map((l) => l.id));
    const visibleQuizzes = quizzes.filter(
      (q) => !q.lessonId || lessonIds.has(q.lessonId),
    );
    const activities = await this.activities.listByLessons([...lessonIds]);
    return {
      course,
      modules: modules.map((m) => ({
        ...m,
        lessons: lessons
          .filter((l) => l.moduleId === m.id)
          .map(toLessonSummary),
        quizzes: visibleQuizzes
          .filter(
            (q) =>
              q.moduleId === m.id ||
              (q.lessonId &&
                lessons.find((l) => l.id === q.lessonId)?.moduleId === m.id),
          )
          .map(toQuizSummary),
      })),
      courseQuizzes: visibleQuizzes
        .filter((q) => !q.moduleId && !q.lessonId)
        .map(toQuizSummary),
      totals: {
        lessons: lessons.length,
        quizzes: visibleQuizzes.length,
        activities: activities.length,
      },
    };
  }

  async getLearnerLesson(lessonId: string): Promise<LearnerLessonView> {
    const lesson = await this.lessons.findById(lessonId);
    if (!lesson || lesson.status !== ContentStatus.PUBLISHED) {
      throw new NotFoundError('Lesson not found');
    }
    const course = await this.getPublishedCourse(lesson.courseId);
    const [activities, quizzes] = await Promise.all([
      this.activities.listByLessons([lessonId]),
      this.quizzes.listByLessons([lessonId]),
    ]);
    return {
      lesson,
      course,
      activities: activities.map(toLearnerActivity),
      quizzes: quizzes.map(toQuizSummary),
    };
  }

  /** Published activity with its answer key (for grading only). */
  async getActivityForGrading(
    activityId: string,
  ): Promise<{ activity: Activity; course: Course }> {
    const activity = await this.activities.findById(activityId);
    if (!activity) throw new NotFoundError('Activity not found');
    await this.getLearnerLesson(activity.lessonId);
    const course = await this.getPublishedCourse(activity.courseId);
    return { activity, course };
  }

  /** Published quiz with answer keys (for grading only). */
  async getQuizForGrading(
    quizId: string,
  ): Promise<{ quiz: Quiz; course: Course }> {
    const quiz = await this.quizzes.findById(quizId);
    if (!quiz) throw new NotFoundError('Quiz not found');
    if (quiz.lessonId) {
      await this.getLearnerLesson(quiz.lessonId);
    }
    const course = await this.getPublishedCourse(quiz.courseId);
    return { quiz, course };
  }

  async getCourseRequirements(courseId: string): Promise<CourseRequirements> {
    const lessons = await this.lessons.list({
      courseId,
      status: ContentStatus.PUBLISHED,
    });
    const lessonIds = lessons.map((l) => l.id);
    const lessonSet = new Set(lessonIds);
    const [quizzes, activities] = await Promise.all([
      this.quizzes.listByCourse(courseId),
      this.activities.listByLessons(lessonIds),
    ]);
    return {
      courseId,
      lessonIds,
      quizIds: quizzes
        .filter((q) => !q.lessonId || lessonSet.has(q.lessonId))
        .map((q) => q.id),
      activityIds: activities.map((a) => a.id),
    };
  }

  listPublishedLessons(filter: Omit<LessonFilter, 'status'>, limit = 20) {
    return this.lessons.list(
      { ...filter, status: ContentStatus.PUBLISHED },
      limit,
    );
  }

  countCourses(filter: CourseFilter = {}): Promise<number> {
    return this.courses.count(filter);
  }

  countCoursesByLanguage(filter: CourseFilter = {}) {
    return this.courses.countByLanguage(filter);
  }
}
