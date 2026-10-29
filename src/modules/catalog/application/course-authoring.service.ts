import { Inject, Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import type { Actor } from '../../../shared/application/actor';
import type { EventBus } from '../../../shared/application/event-bus.port';
import { EVENT_BUS } from '../../../shared/application/event-bus.port';
import { CoursePublished } from '../../../shared/contracts/events';
import { ContentStatus, ProficiencyLevel } from '../../../shared/domain/enums';
import {
  ConflictError,
  NotFoundError,
  ValidationError,
} from '../../../shared/domain/errors';
import { Page, PageRequest } from '../../../shared/domain/pagination';
import {
  PLATFORM_CONTENT_ROLES,
  UserRole,
} from '../../../shared/domain/user-role';
import { Activity, ActivityType } from '../domain/activity.entity';
import {
  assertCanManageCourse,
  assertContentAuthor,
} from '../domain/content-access.policy';
import {
  AgeGroup,
  Course,
  CourseModule,
  CourseType,
} from '../domain/course.entity';
import { MediaKind, MediaService } from '../../media';
import { Lesson, LessonBlock, LessonBlockType } from '../domain/lesson.entity';

const BLOCK_MEDIA_KIND: Partial<Record<LessonBlockType, MediaKind>> = {
  [LessonBlockType.IMAGE]: MediaKind.IMAGE,
  [LessonBlockType.AUDIO]: MediaKind.AUDIO,
  [LessonBlockType.VIDEO]: MediaKind.VIDEO,
  [LessonBlockType.PRONUNCIATION]: MediaKind.AUDIO,
};
import {
  assertValidQuestions,
  QuestionType,
  Quiz,
  QuizQuestion,
} from '../domain/quiz.entity';
import type {
  ActivityRepository,
  CourseFilter,
  CourseRepository,
  LanguageRepository,
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

const QUESTION_MEDIA_KIND: Partial<Record<QuestionType, MediaKind>> = {
  [QuestionType.IMAGE]: MediaKind.IMAGE,
  [QuestionType.AUDIO]: MediaKind.AUDIO,
};

export interface CourseInput {
  languageCode: string;
  level: ProficiencyLevel;
  title: string;
  description?: string;
  courseType?: CourseType;
  ageGroup?: AgeGroup;
  durationMinutes?: number;
  isPremium?: boolean;
  coverImageUrl?: string;
  tags?: string[];
}

export interface ModuleInput {
  title: string;
  description?: string;
  order?: number;
}

export interface LessonInput {
  title: string;
  summary?: string;
  blocks?: LessonBlock[];
  vocabulary?: string[];
  vocabularyIds?: string[];
  pronunciationNotes?: string[];
  culturalNotes?: string[];
  gamecardCodes?: string[];
  estimatedMinutes?: number;
  order?: number;
}

export interface ActivityInput {
  type: ActivityType;
  prompt?: string;
  payload: Record<string, unknown>;
  solution?: unknown;
  ordered?: boolean;
  feedback?: { correct?: string; incorrect?: string };
  order?: number;
}

export type QuestionInput = Omit<QuizQuestion, 'id' | 'points'> & {
  id?: string;
  points?: number;
};

export interface QuizInput {
  moduleId?: string;
  lessonId?: string;
  title: string;
  description?: string;
  questions: QuestionInput[];
  passScorePercent?: number;
  timerSeconds?: number;
  randomizeQuestions?: boolean;
  maxAttempts?: number;
  allowReview?: boolean;
}

export interface AuthorCourseTree {
  course: Course;
  modules: Array<
    CourseModule & {
      lessons: Array<Lesson & { activities: Activity[]; quizzes: Quiz[] }>;
      quizzes: Quiz[];
    }
  >;
  courseQuizzes: Quiz[];
}

/** Content management use cases (teachers, content creators, admins). */
@Injectable()
export class CourseAuthoringService {
  constructor(
    @Inject(LANGUAGE_REPOSITORY) private readonly languages: LanguageRepository,
    @Inject(COURSE_REPOSITORY) private readonly courses: CourseRepository,
    @Inject(MODULE_REPOSITORY) private readonly modules: ModuleRepository,
    @Inject(LESSON_REPOSITORY) private readonly lessons: LessonRepository,
    @Inject(ACTIVITY_REPOSITORY)
    private readonly activities: ActivityRepository,
    @Inject(QUIZ_REPOSITORY) private readonly quizzes: QuizRepository,
    @Inject(EVENT_BUS) private readonly events: EventBus,
    private readonly media: MediaService,
  ) {}

  // ---- Courses --------------------------------------------------------------

  async listManageable(
    actor: Actor,
    filter: CourseFilter,
    page: PageRequest,
  ): Promise<Page<Course>> {
    assertContentAuthor(actor);
    const scoped: CourseFilter = { ...filter };
    if (actor.role === UserRole.TEACHER) scoped.createdByUserId = actor.userId;
    if (actor.role === UserRole.SCHOOL_ADMIN) {
      if (!actor.schoolId)
        return { items: [], page: page.page, limit: page.limit, total: 0 };
      scoped.schoolId = actor.schoolId;
    }
    return this.courses.list(scoped, page);
  }

  async createCourse(actor: Actor, input: CourseInput): Promise<Course> {
    assertContentAuthor(actor);
    await this.assertLanguage(input.languageCode);
    const isPlatform = PLATFORM_CONTENT_ROLES.includes(actor.role);
    return this.courses.create({
      ...input,
      languageCode: input.languageCode.toLowerCase(),
      courseType: input.courseType ?? CourseType.LANGUAGE,
      ageGroup: input.ageGroup ?? AgeGroup.ALL,
      isPremium: input.isPremium ?? false,
      tags: input.tags ?? [],
      status: ContentStatus.DRAFT,
      createdByUserId: actor.userId,
      schoolId: isPlatform ? null : (actor.schoolId ?? null),
      publishedAt: null,
    });
  }

  async updateCourse(
    actor: Actor,
    courseId: string,
    input: Partial<CourseInput>,
  ): Promise<Course> {
    await this.requireManagedCourse(actor, courseId);
    if (input.languageCode) await this.assertLanguage(input.languageCode);
    return (await this.courses.update(courseId, {
      ...input,
      ...(input.languageCode
        ? { languageCode: input.languageCode.toLowerCase() }
        : {}),
    })) as Course;
  }

  async publishCourse(actor: Actor, courseId: string): Promise<Course> {
    const course = await this.requireManagedCourse(actor, courseId);
    const publishedLessons = await this.lessons.list(
      { courseId, status: ContentStatus.PUBLISHED },
      1,
    );
    if (!publishedLessons.length) {
      throw new ValidationError(
        'Publish at least one lesson before publishing the course',
      );
    }
    const firstPublish = !course.publishedAt;
    const updated = (await this.courses.update(courseId, {
      status: ContentStatus.PUBLISHED,
      publishedAt: course.publishedAt ?? new Date(),
    })) as Course;
    if (firstPublish) {
      await this.events.publish(
        new CoursePublished(updated.id, updated.title, updated.languageCode),
      );
    }
    return updated;
  }

  async unpublishCourse(actor: Actor, courseId: string): Promise<Course> {
    await this.requireManagedCourse(actor, courseId);
    return (await this.courses.update(courseId, {
      status: ContentStatus.DRAFT,
    })) as Course;
  }

  /**
   * Never-published courses are deleted with their content. Courses that
   * learners may have taken are archived so progress and certificates stay
   * consistent.
   */
  async deleteCourse(
    actor: Actor,
    courseId: string,
  ): Promise<{ archived: boolean }> {
    const course = await this.requireManagedCourse(actor, courseId);
    if (course.publishedAt) {
      await this.courses.update(courseId, { status: ContentStatus.ARCHIVED });
      return { archived: true };
    }
    const lessons = await this.lessons.list({ courseId });
    const lessonIds = lessons.map((l) => l.id);
    await this.activities.deleteByLessons(lessonIds);
    await this.quizzes.deleteMany({ courseId });
    await this.lessons.deleteMany({ courseId });
    await this.modules.deleteByCourse(courseId);
    await this.courses.delete(courseId);
    return { archived: false };
  }

  async getCourseTree(
    actor: Actor,
    courseId: string,
  ): Promise<AuthorCourseTree> {
    const course = await this.requireManagedCourse(actor, courseId);
    const [modules, lessons, quizzes] = await Promise.all([
      this.modules.listByCourse(courseId),
      this.lessons.list({ courseId }),
      this.quizzes.listByCourse(courseId),
    ]);
    const activities = await this.activities.listByLessons(
      lessons.map((l) => l.id),
    );
    return {
      course,
      modules: modules.map((m) => ({
        ...m,
        lessons: lessons
          .filter((l) => l.moduleId === m.id)
          .map((l) => ({
            ...l,
            activities: activities.filter((a) => a.lessonId === l.id),
            quizzes: quizzes.filter((q) => q.lessonId === l.id),
          })),
        quizzes: quizzes.filter((q) => q.moduleId === m.id && !q.lessonId),
      })),
      courseQuizzes: quizzes.filter((q) => !q.moduleId && !q.lessonId),
    };
  }

  // ---- Modules --------------------------------------------------------------

  async createModule(actor: Actor, courseId: string, input: ModuleInput) {
    await this.requireManagedCourse(actor, courseId);
    const order =
      input.order ?? (await this.modules.listByCourse(courseId)).length + 1;
    return this.modules.create({ ...input, courseId, order });
  }

  async updateModule(
    actor: Actor,
    moduleId: string,
    input: Partial<ModuleInput>,
  ) {
    await this.requireManagedModule(actor, moduleId);
    return this.modules.update(moduleId, input);
  }

  async deleteModule(actor: Actor, moduleId: string): Promise<void> {
    await this.requireManagedModule(actor, moduleId);
    const lessons = await this.lessons.list({ moduleId });
    const lessonIds = lessons.map((l) => l.id);
    await this.activities.deleteByLessons(lessonIds);
    await this.quizzes.deleteMany({ lessonIds });
    await this.quizzes.deleteMany({ moduleId });
    await this.lessons.deleteMany({ moduleId });
    await this.modules.delete(moduleId);
  }

  // ---- Lessons --------------------------------------------------------------

  async createLesson(actor: Actor, moduleId: string, input: LessonInput) {
    const module = await this.requireManagedModule(actor, moduleId);
    const order =
      input.order ?? (await this.lessons.list({ moduleId })).length + 1;
    if (input.blocks) input.blocks = await this.attachMedia(input.blocks);
    return this.lessons.create({
      blocks: [],
      vocabulary: [],
      vocabularyIds: [],
      pronunciationNotes: [],
      culturalNotes: [],
      gamecardCodes: [],
      ...input,
      courseId: module.courseId,
      moduleId,
      order,
      status: ContentStatus.DRAFT,
    });
  }

  async updateLesson(
    actor: Actor,
    lessonId: string,
    input: Partial<LessonInput>,
  ) {
    await this.requireManagedLesson(actor, lessonId);
    if (input.blocks) input.blocks = await this.attachMedia(input.blocks);
    return this.lessons.update(lessonId, input);
  }

  /**
   * Blocks may point at an uploaded file with `mediaAssetId`. The file must
   * be in the content library and match the block type; `mediaUrl` is then
   * filled from it so lessons always carry a playable link.
   */
  private async attachMedia(blocks: LessonBlock[]): Promise<LessonBlock[]> {
    const refs = blocks
      .filter((b) => b.mediaAssetId)
      .map((b) => ({
        id: b.mediaAssetId as string,
        kind: BLOCK_MEDIA_KIND[b.type],
      }));
    if (!refs.length) return blocks;
    const assets = await this.media.requireContentAssets(refs);
    return blocks.map((b) =>
      b.mediaAssetId
        ? { ...b, mediaUrl: assets.get(b.mediaAssetId)?.url ?? b.mediaUrl }
        : b,
    );
  }

  async setLessonStatus(actor: Actor, lessonId: string, status: ContentStatus) {
    await this.requireManagedLesson(actor, lessonId);
    return this.lessons.update(lessonId, { status });
  }

  async deleteLesson(actor: Actor, lessonId: string): Promise<void> {
    await this.requireManagedLesson(actor, lessonId);
    await this.activities.deleteByLessons([lessonId]);
    await this.quizzes.deleteMany({ lessonIds: [lessonId] });
    await this.lessons.delete(lessonId);
  }

  // ---- Activities -----------------------------------------------------------

  async createActivity(actor: Actor, lessonId: string, input: ActivityInput) {
    const lesson = await this.requireManagedLesson(actor, lessonId);
    const order =
      input.order ??
      (await this.activities.listByLessons([lessonId])).length + 1;
    return this.activities.create({
      ...input,
      courseId: lesson.courseId,
      lessonId,
      order,
    });
  }

  async updateActivity(
    actor: Actor,
    activityId: string,
    input: Partial<ActivityInput>,
  ) {
    await this.requireManagedActivity(actor, activityId);
    return this.activities.update(activityId, input);
  }

  async deleteActivity(actor: Actor, activityId: string): Promise<void> {
    await this.requireManagedActivity(actor, activityId);
    await this.activities.delete(activityId);
  }

  // ---- Quizzes --------------------------------------------------------------

  async createQuiz(
    actor: Actor,
    courseId: string,
    input: QuizInput,
  ): Promise<Quiz> {
    await this.requireManagedCourse(actor, courseId);
    await this.assertQuizPlacement(courseId, input.moduleId, input.lessonId);
    const questions = await this.attachQuestionMedia(
      normalizeQuestions(input.questions),
    );
    assertValidQuestions(questions);
    return this.quizzes.create({
      courseId,
      moduleId: input.moduleId,
      lessonId: input.lessonId,
      title: input.title,
      description: input.description,
      questions,
      passScorePercent: input.passScorePercent ?? 70,
      timerSeconds: input.timerSeconds,
      randomizeQuestions: input.randomizeQuestions ?? false,
      maxAttempts: input.maxAttempts,
      allowReview: input.allowReview ?? true,
    });
  }

  async updateQuiz(
    actor: Actor,
    quizId: string,
    input: Partial<QuizInput>,
  ): Promise<Quiz> {
    const quiz = await this.requireManagedQuiz(actor, quizId);
    const patch: Partial<Quiz> = { ...input, questions: undefined };
    if (input.moduleId !== undefined || input.lessonId !== undefined) {
      await this.assertQuizPlacement(
        quiz.courseId,
        input.moduleId ?? quiz.moduleId,
        input.lessonId ?? quiz.lessonId,
      );
    }
    if (input.questions) {
      patch.questions = await this.attachQuestionMedia(
        normalizeQuestions(input.questions),
      );
      assertValidQuestions(patch.questions);
    } else {
      delete patch.questions;
    }
    return (await this.quizzes.update(quizId, patch)) as Quiz;
  }

  /** Same as lesson blocks: `mediaAssetId` must be a matching content upload. */
  private async attachQuestionMedia(
    questions: QuizQuestion[],
  ): Promise<QuizQuestion[]> {
    const refs = questions
      .filter((q) => q.mediaAssetId)
      .map((q) => ({
        id: q.mediaAssetId as string,
        kind: QUESTION_MEDIA_KIND[q.type],
      }));
    if (!refs.length) return questions;
    const assets = await this.media.requireContentAssets(refs);
    return questions.map((q) =>
      q.mediaAssetId
        ? { ...q, mediaUrl: assets.get(q.mediaAssetId)?.url ?? q.mediaUrl }
        : q,
    );
  }

  async deleteQuiz(actor: Actor, quizId: string): Promise<void> {
    await this.requireManagedQuiz(actor, quizId);
    await this.quizzes.delete(quizId);
  }

  async getQuizForAuthor(actor: Actor, quizId: string): Promise<Quiz> {
    return this.requireManagedQuiz(actor, quizId);
  }

  // ---- Guards ---------------------------------------------------------------

  private async assertLanguage(code: string): Promise<void> {
    const language = await this.languages.findByCode(code);
    if (!language || !language.isActive) {
      throw new ValidationError(`Unknown or inactive language: ${code}`);
    }
  }

  private async assertQuizPlacement(
    courseId: string,
    moduleId?: string,
    lessonId?: string,
  ): Promise<void> {
    if (lessonId) {
      const lesson = await this.lessons.findById(lessonId);
      if (!lesson || lesson.courseId !== courseId) {
        throw new ValidationError('lessonId does not belong to this course');
      }
    }
    if (moduleId) {
      const module = await this.modules.findById(moduleId);
      if (!module || module.courseId !== courseId) {
        throw new ValidationError('moduleId does not belong to this course');
      }
    }
  }

  private async requireManagedCourse(
    actor: Actor,
    courseId: string,
  ): Promise<Course> {
    assertContentAuthor(actor);
    const course = await this.courses.findById(courseId);
    if (!course) throw new NotFoundError('Course not found');
    assertCanManageCourse(actor, course);
    return course;
  }

  private async requireManagedModule(actor: Actor, moduleId: string) {
    const module = await this.modules.findById(moduleId);
    if (!module) throw new NotFoundError('Module not found');
    await this.requireManagedCourse(actor, module.courseId);
    return module;
  }

  private async requireManagedLesson(actor: Actor, lessonId: string) {
    const lesson = await this.lessons.findById(lessonId);
    if (!lesson) throw new NotFoundError('Lesson not found');
    await this.requireManagedCourse(actor, lesson.courseId);
    return lesson;
  }

  private async requireManagedActivity(actor: Actor, activityId: string) {
    const activity = await this.activities.findById(activityId);
    if (!activity) throw new NotFoundError('Activity not found');
    await this.requireManagedCourse(actor, activity.courseId);
    return activity;
  }

  private async requireManagedQuiz(actor: Actor, quizId: string) {
    const quiz = await this.quizzes.findById(quizId);
    if (!quiz) throw new NotFoundError('Quiz not found');
    await this.requireManagedCourse(actor, quiz.courseId);
    return quiz;
  }
}

/** Gives every question a stable id so answers survive reordering. */
export function normalizeQuestions(inputs: QuestionInput[]): QuizQuestion[] {
  const seen = new Set<string>();
  return inputs.map((q) => {
    const id = q.id ?? randomUUID();
    if (seen.has(id)) throw new ConflictError(`Duplicate question id ${id}`);
    seen.add(id);
    const raw = q.correctAnswer as unknown;
    // Accept JSON booleans for true/false questions.
    const correctAnswer =
      typeof raw === 'boolean' ? (raw ? 'true' : 'false') : q.correctAnswer;
    return { ...q, id, correctAnswer, points: q.points ?? 1 };
  });
}
