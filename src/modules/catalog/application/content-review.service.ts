import { Inject, Injectable } from '@nestjs/common';
import type { Actor } from '../../../shared/application/actor';
import type { EventBus } from '../../../shared/application/event-bus.port';
import { EVENT_BUS } from '../../../shared/application/event-bus.port';
import {
  ContentReviewDecided,
  CourseMadePrivateByAdmin,
  CoursePublished,
} from '../../../shared/contracts/events';
import { ContentStatus } from '../../../shared/domain/enums';
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from '../../../shared/domain/errors';
import { Page, PageRequest } from '../../../shared/domain/pagination';
import { PublicUser, UsersService, VerificationStatus } from '../../identity';
import {
  Course,
  CourseOwnerType,
  CourseVisibility,
  ReviewRecord,
} from '../domain/course.entity';
import { Lesson } from '../domain/lesson.entity';
import { CourseAuthoringService } from './course-authoring.service';
import type {
  CourseFilter,
  CourseRepository,
  LessonRepository,
} from './ports/catalog.repositories.port';
import {
  COURSE_REPOSITORY,
  LESSON_REPOSITORY,
} from './ports/catalog.repositories.port';

export interface AuthorSummary {
  id: string;
  name: string;
  role: string;
  isVerified: boolean;
}

const QUEUE_LIMIT = 100;

function authorOf(user: PublicUser | undefined): AuthorSummary | null {
  if (!user) return null;
  return {
    id: user.id,
    name: [user.firstName, user.lastName].filter(Boolean).join(' '),
    role: user.role,
    isVerified: user.verificationStatus === VerificationStatus.VERIFIED,
  };
}

/**
 * Super admin review (M-19, M-25): approves or rejects courses and lessons
 * waiting in review and teachers' requests to make a course Public.
 */
@Injectable()
export class ContentReviewService {
  constructor(
    @Inject(COURSE_REPOSITORY) private readonly courses: CourseRepository,
    @Inject(LESSON_REPOSITORY) private readonly lessons: LessonRepository,
    @Inject(EVENT_BUS) private readonly events: EventBus,
    private readonly authoring: CourseAuthoringService,
    private readonly users: UsersService,
  ) {}

  /** Everything waiting for a decision, oldest first. */
  async queue() {
    const [courses, lessons, visibility] = await Promise.all([
      this.courses.list(
        { status: ContentStatus.IN_REVIEW },
        { page: 1, limit: QUEUE_LIMIT },
      ),
      this.lessons.list({ status: ContentStatus.IN_REVIEW }, QUEUE_LIMIT),
      this.courses.list(
        { publicRequestPending: true },
        { page: 1, limit: QUEUE_LIMIT },
      ),
    ]);
    const lessonCourses = await this.courses.findByIds(
      lessons.map((l) => l.courseId),
    );
    const courseTitles = new Map(lessonCourses.map((c) => [c.id, c.title]));
    const authors = await this.authorsOf([
      ...courses.items.map((c) => c.review?.submittedByUserId),
      ...lessons.map((l) => l.review?.submittedByUserId),
      ...visibility.items.map((c) => c.publicRequest?.requestedByUserId),
    ]);
    const bySubmitted = <T extends { submittedAt?: Date | null }>(a: T, b: T) =>
      (a.submittedAt?.getTime() ?? 0) - (b.submittedAt?.getTime() ?? 0);
    return {
      courses: courses.items
        .map((c) => ({
          type: 'course' as const,
          id: c.id,
          title: c.title,
          languageCode: c.languageCode,
          level: c.level,
          ownerType: c.ownerType,
          visibility: c.visibility,
          submittedAt: c.review?.submittedAt ?? null,
          submittedBy: authors.get(c.review?.submittedByUserId ?? '') ?? null,
        }))
        .sort(bySubmitted),
      lessons: lessons
        .map((l) => ({
          type: 'lesson' as const,
          id: l.id,
          title: l.title,
          courseId: l.courseId,
          courseTitle: courseTitles.get(l.courseId) ?? null,
          submittedAt: l.review?.submittedAt ?? null,
          submittedBy: authors.get(l.review?.submittedByUserId ?? '') ?? null,
        }))
        .sort(bySubmitted),
      visibilityRequests: visibility.items
        .map((c) => ({
          type: 'visibility' as const,
          id: c.id,
          title: c.title,
          currentVisibility: c.visibility,
          requestedVisibility: CourseVisibility.PUBLIC,
          submittedAt: c.publicRequest?.requestedAt ?? null,
          submittedBy:
            authors.get(c.publicRequest?.requestedByUserId ?? '') ?? null,
        }))
        .sort(bySubmitted),
      totals: {
        courses: courses.total,
        lessons: lessons.length,
        visibilityRequests: visibility.total,
      },
    };
  }

  async countPending(): Promise<number> {
    const [courses, lessons, visibility] = await Promise.all([
      this.courses.count({ status: ContentStatus.IN_REVIEW }),
      this.lessons.list({ status: ContentStatus.IN_REVIEW }, QUEUE_LIMIT),
      this.courses.count({ publicRequestPending: true }),
    ]);
    return courses + lessons.length + visibility;
  }

  /** Admin content list across every author, with visibility and review state. */
  async listCourses(filter: CourseFilter, page: PageRequest) {
    const result: Page<Course> = await this.courses.list(filter, page);
    const authors = await this.authorsOf(
      result.items.map((c) => c.createdByUserId),
    );
    return {
      ...result,
      items: result.items.map((c) => ({
        ...c,
        byAtupa: c.ownerType === CourseOwnerType.ATUPA,
        author: authors.get(c.createdByUserId ?? '') ?? null,
      })),
    };
  }

  // ---- Courses --------------------------------------------------------------

  async approveCourse(actor: Actor, courseId: string, comment?: string) {
    const course = await this.requireCourse(courseId);
    if (course.status !== ContentStatus.IN_REVIEW) {
      throw new ConflictError('This course is not waiting for review');
    }
    this.assertNotOwnWork(actor, course.review);
    // The lessons submitted with the course go live with it.
    const waiting = await this.lessons.list({
      courseId,
      status: ContentStatus.IN_REVIEW,
    });
    for (const lesson of waiting) {
      await this.lessons.update(lesson.id, {
        status: ContentStatus.PUBLISHED,
        review: this.decision(actor, lesson.review, 'approved', comment),
      });
    }
    const live = await this.authoring.goLive(
      course,
      this.decision(actor, course.review, 'approved', comment),
    );
    await this.announce('course', live, course.review, true, comment);
    return live;
  }

  async rejectCourse(actor: Actor, courseId: string, comment: string) {
    const course = await this.requireCourse(courseId);
    if (course.status !== ContentStatus.IN_REVIEW) {
      throw new ConflictError('This course is not waiting for review');
    }
    this.assertNotOwnWork(actor, course.review);
    const waiting = await this.lessons.list({
      courseId,
      status: ContentStatus.IN_REVIEW,
    });
    for (const lesson of waiting) {
      await this.lessons.update(lesson.id, {
        status: ContentStatus.DRAFT,
        review: this.decision(actor, lesson.review, 'rejected', comment),
      });
    }
    const updated = (await this.courses.update(courseId, {
      status: ContentStatus.DRAFT,
      review: this.decision(actor, course.review, 'rejected', comment),
    })) as Course;
    await this.announce('course', updated, course.review, false, comment);
    return updated;
  }

  // ---- Lessons --------------------------------------------------------------

  async approveLesson(actor: Actor, lessonId: string, comment?: string) {
    const lesson = await this.requireLessonInReview(lessonId);
    this.assertNotOwnWork(actor, lesson.review);
    const updated = (await this.lessons.update(lessonId, {
      status: ContentStatus.PUBLISHED,
      review: this.decision(actor, lesson.review, 'approved', comment),
    })) as Lesson;
    await this.announce('lesson', updated, lesson.review, true, comment);
    return updated;
  }

  async rejectLesson(actor: Actor, lessonId: string, comment: string) {
    const lesson = await this.requireLessonInReview(lessonId);
    this.assertNotOwnWork(actor, lesson.review);
    const updated = (await this.lessons.update(lessonId, {
      status: ContentStatus.DRAFT,
      review: this.decision(actor, lesson.review, 'rejected', comment),
    })) as Lesson;
    await this.announce('lesson', updated, lesson.review, false, comment);
    return updated;
  }

  // ---- Visibility -------------------------------------------------------------

  async approvePublic(actor: Actor, courseId: string, comment?: string) {
    const course = await this.requireCourse(courseId);
    if (course.publicRequest?.status !== 'pending') {
      throw new ConflictError(
        'There is no pending request to make this Public',
      );
    }
    if (course.publicRequest.requestedByUserId === actor.userId) {
      throw new ForbiddenError('Someone else must approve your own request');
    }
    const updated = (await this.courses.update(courseId, {
      visibility: CourseVisibility.PUBLIC,
      publicRequest: null,
    })) as Course;
    if (updated.status === ContentStatus.PUBLISHED) {
      await this.events.publish(
        new CoursePublished(updated.id, updated.title, updated.languageCode),
      );
    }
    await this.events.publish(
      new ContentReviewDecided(
        'course_visibility',
        courseId,
        course.title,
        course.publicRequest.requestedByUserId,
        true,
        comment,
      ),
    );
    return updated;
  }

  async rejectPublic(actor: Actor, courseId: string, comment: string) {
    const course = await this.requireCourse(courseId);
    if (course.publicRequest?.status !== 'pending') {
      throw new ConflictError(
        'There is no pending request to make this Public',
      );
    }
    const updated = (await this.courses.update(courseId, {
      publicRequest: {
        ...course.publicRequest,
        status: 'rejected',
        reviewedAt: new Date(),
        reviewedByUserId: actor.userId,
        comment,
      },
    })) as Course;
    await this.events.publish(
      new ContentReviewDecided(
        'course_visibility',
        courseId,
        course.title,
        course.publicRequest.requestedByUserId,
        false,
        comment,
      ),
    );
    return updated;
  }

  /**
   * Super admin override, e.g. switching a teacher's course back to Private.
   * Lowering visibility tells the teacher why.
   */
  async setVisibility(
    courseId: string,
    visibility: CourseVisibility,
    reason: string,
  ): Promise<Course> {
    const course = await this.requireCourse(courseId);
    if (course.ownerType === CourseOwnerType.ATUPA) {
      throw new ValidationError(
        'ATUPA courses are always Public. Unpublish the course to hide it.',
      );
    }
    if (visibility === CourseVisibility.SCHOOL && !course.schoolId) {
      throw new ValidationError('This course does not belong to a school');
    }
    const updated = (await this.courses.update(courseId, {
      visibility,
      publicRequest: null,
    })) as Course;
    if (
      course.visibility === CourseVisibility.PUBLIC &&
      visibility !== CourseVisibility.PUBLIC
    ) {
      await this.events.publish(
        new CourseMadePrivateByAdmin(
          courseId,
          course.title,
          course.createdByUserId,
          reason,
        ),
      );
    }
    return updated;
  }

  /** Safety outcome "hide the course": unlisted and taken offline. */
  async hideCourse(courseId: string, reason: string): Promise<Course> {
    const course = await this.requireCourse(courseId);
    const updated = (await this.courses.update(courseId, {
      status:
        course.status === ContentStatus.ARCHIVED
          ? ContentStatus.ARCHIVED
          : ContentStatus.DRAFT,
      visibility:
        course.ownerType === CourseOwnerType.ATUPA
          ? course.visibility
          : CourseVisibility.PRIVATE,
      publicRequest: null,
    })) as Course;
    await this.events.publish(
      new CourseMadePrivateByAdmin(
        courseId,
        course.title,
        course.createdByUserId,
        reason,
      ),
    );
    return updated;
  }

  /** When a teacher is suspended or rejected, their Public courses go Private. */
  async makeAuthorCoursesPrivate(userId: string): Promise<number> {
    const page = await this.courses.list(
      { createdByUserId: userId },
      { page: 1, limit: 500 },
    );
    let changed = 0;
    for (const course of page.items) {
      if (course.ownerType === CourseOwnerType.ATUPA) continue;
      if (
        course.visibility === CourseVisibility.PUBLIC ||
        course.publicRequest
      ) {
        await this.courses.update(course.id, {
          visibility: CourseVisibility.PRIVATE,
          publicRequest: null,
        });
        changed++;
      }
    }
    return changed;
  }

  // ---- Helpers ----------------------------------------------------------------

  private async authorsOf(ids: Array<string | null | undefined>) {
    const users = await this.users.findByIds(
      [...new Set(ids.filter((id): id is string => !!id))].filter((id) =>
        /^[a-f0-9]{24}$/i.test(id),
      ),
    );
    return new Map(users.map((u) => [u.id, authorOf(u) as AuthorSummary]));
  }

  private decision(
    actor: Actor,
    previous: ReviewRecord | null | undefined,
    decision: 'approved' | 'rejected',
    comment?: string,
  ): ReviewRecord {
    return {
      submittedAt: previous?.submittedAt ?? null,
      submittedByUserId: previous?.submittedByUserId ?? null,
      reviewedAt: new Date(),
      reviewedByUserId: actor.userId,
      decision,
      comment: comment ?? null,
    };
  }

  /** "A different person approves it." */
  private assertNotOwnWork(actor: Actor, review?: ReviewRecord | null) {
    if (review?.submittedByUserId === actor.userId) {
      throw new ForbiddenError('Someone else must review your own work');
    }
  }

  private async announce(
    contentType: 'course' | 'lesson',
    content: { id: string; title: string },
    review: ReviewRecord | null | undefined,
    approved: boolean,
    comment?: string,
  ) {
    await this.events.publish(
      new ContentReviewDecided(
        contentType,
        content.id,
        content.title,
        review?.submittedByUserId ?? undefined,
        approved,
        comment,
      ),
    );
  }

  private async requireCourse(courseId: string): Promise<Course> {
    const course = await this.courses.findById(courseId);
    if (!course) throw new NotFoundError('Course not found');
    return course;
  }

  private async requireLessonInReview(lessonId: string): Promise<Lesson> {
    const lesson = await this.lessons.findById(lessonId);
    if (!lesson) throw new NotFoundError('Lesson not found');
    if (lesson.status !== ContentStatus.IN_REVIEW) {
      throw new ConflictError('This lesson is not waiting for review');
    }
    return lesson;
  }
}
