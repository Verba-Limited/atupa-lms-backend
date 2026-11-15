import { Inject, Injectable } from '@nestjs/common';
import type { Actor } from '../../../shared/application/actor';
import type { EventBus } from '../../../shared/application/event-bus.port';
import { EVENT_BUS } from '../../../shared/application/event-bus.port';
import {
  ClassAnnouncementPosted,
  LearnerFacingTextSaved,
  LearnersJoinedClass,
} from '../../../shared/contracts/events';
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from '../../../shared/domain/errors';
import { Page, PageRequest } from '../../../shared/domain/pagination';
import { randomCode } from '../../../shared/domain/random-code';
import {
  STAFF_ROLES,
  SUPPORT_ROLES,
  UserRole,
} from '../../../shared/domain/user-role';
import {
  CatalogQueryService,
  type Course,
  CourseVisibility,
} from '../../catalog';
import { PublicUser, UsersService } from '../../identity';
import {
  assertCanManageClass,
  canViewClass,
  Classroom,
} from '../domain/classroom.entity';
import type {
  ClassroomFilter,
  ClassroomRepository,
} from './ports/classroom.repository.port';
import { CLASSROOM_REPOSITORY } from './ports/classroom.repository.port';

export interface ClassInput {
  name: string;
  description?: string;
  languageCode?: string;
  teacherUserId?: string;
  schoolId?: string;
}

@Injectable()
export class ClassesService {
  constructor(
    @Inject(CLASSROOM_REPOSITORY) private readonly classes: ClassroomRepository,
    @Inject(EVENT_BUS) private readonly events: EventBus,
    private readonly users: UsersService,
    private readonly catalog: CatalogQueryService,
  ) {}

  async create(actor: Actor, input: ClassInput): Promise<Classroom> {
    let schoolId: string | null;
    let teacherUserId: string;
    switch (actor.role) {
      case UserRole.TEACHER:
        schoolId = actor.schoolId ?? null;
        teacherUserId = actor.userId;
        break;
      case UserRole.SCHOOL_ADMIN:
        if (!actor.schoolId)
          throw new ForbiddenError('You are not attached to a school');
        schoolId = actor.schoolId;
        if (!input.teacherUserId)
          throw new ValidationError('teacherUserId is required');
        teacherUserId = input.teacherUserId;
        break;
      case UserRole.SUPER_ADMIN:
      case UserRole.SUPPORT_ADMIN:
        // ATUPA staff create classes for any teacher (M-12); schoolId is
        // optional because most teachers work independently.
        if (!input.teacherUserId) {
          throw new ValidationError('teacherUserId is required');
        }
        schoolId = input.schoolId ?? null;
        teacherUserId = input.teacherUserId;
        break;
      default:
        throw new ForbiddenError('You cannot create classes');
    }
    if (teacherUserId !== actor.userId) {
      await this.assertTeacherInSchool(
        teacherUserId,
        schoolId,
        SUPPORT_ROLES.includes(actor.role) && !schoolId,
      );
    }
    return this.classes.create({
      schoolId,
      name: input.name,
      description: input.description,
      languageCode: input.languageCode?.toLowerCase(),
      teacherUserId,
      studentUserIds: [],
      assignedCourseIds: [],
      joinCode: randomCode(8),
      isArchived: false,
    });
  }

  list(
    actor: Actor,
    filter: { schoolId?: string; teacherUserId?: string },
    page: PageRequest,
  ): Promise<Page<Classroom>> {
    const scoped: ClassroomFilter = {};
    switch (actor.role) {
      case UserRole.TEACHER:
        scoped.teacherUserId = actor.userId;
        break;
      case UserRole.SCHOOL_ADMIN:
        if (!actor.schoolId)
          return Promise.resolve({
            items: [],
            page: page.page,
            limit: page.limit,
            total: 0,
          });
        scoped.schoolId = actor.schoolId;
        break;
      case UserRole.LEARNER:
        scoped.studentUserId = actor.userId;
        break;
      case UserRole.SUPER_ADMIN:
      case UserRole.SUPPORT_ADMIN:
        scoped.schoolId = filter.schoolId;
        scoped.teacherUserId = filter.teacherUserId;
        break;
      default:
        throw new ForbiddenError('You cannot list classes');
    }
    return this.classes.list(scoped, page);
  }

  async get(actor: Actor, classId: string) {
    const classroom = await this.require(classId);
    if (!canViewClass(actor, classroom))
      throw new ForbiddenError('You cannot view this class');
    if (actor.role === UserRole.LEARNER) {
      const { studentUserIds, joinCode, ...rest } = classroom;
      void studentUserIds;
      void joinCode;
      return { ...rest, studentCount: classroom.studentUserIds.length };
    }
    const [teacher, students, courses] = await Promise.all([
      this.users.findById(classroom.teacherUserId),
      this.users.findByIds(classroom.studentUserIds),
      this.catalog.findCourses(classroom.assignedCourseIds),
    ]);
    return { ...classroom, teacher, students, courses };
  }

  async update(
    actor: Actor,
    classId: string,
    patch: Partial<Omit<ClassInput, 'schoolId' | 'teacherUserId'>>,
  ) {
    assertCanManageClass(actor, await this.require(classId));
    return this.classes.update(classId, patch);
  }

  async archive(actor: Actor, classId: string): Promise<void> {
    assertCanManageClass(actor, await this.require(classId));
    await this.classes.update(classId, { isArchived: true });
  }

  async setTeacher(actor: Actor, classId: string, teacherUserId: string) {
    const classroom = await this.require(classId);
    if (
      actor.role !== UserRole.SCHOOL_ADMIN &&
      !SUPPORT_ROLES.includes(actor.role)
    ) {
      throw new ForbiddenError('Only administrators can assign teachers');
    }
    assertCanManageClass(actor, classroom);
    await this.assertTeacherInSchool(
      teacherUserId,
      classroom.schoolId,
      SUPPORT_ROLES.includes(actor.role) && !classroom.schoolId,
    );
    return this.classes.update(classId, { teacherUserId });
  }

  /**
   * Adds learners to a class. Teachers add school members only; learners
   * outside the school (or for an independent class) join with the class
   * code themselves. ATUPA support staff may add any learner (M-10).
   */
  async addStudents(
    actor: Actor,
    classId: string,
    studentIds: string[],
  ): Promise<Classroom> {
    const classroom = await this.require(classId);
    assertCanManageClass(actor, classroom);
    const staff = SUPPORT_ROLES.includes(actor.role);
    if (!classroom.schoolId && !staff) {
      throw new ForbiddenError(
        'Learners join independent classes with the class code',
      );
    }
    const students = await this.users.findByIds(studentIds);
    const invalid = studentIds.filter(
      (id) =>
        !students.some(
          (s) =>
            s.id === id &&
            s.role === UserRole.LEARNER &&
            (!classroom.schoolId || s.schoolId === classroom.schoolId),
        ),
    );
    if (invalid.length) {
      throw new ValidationError(
        classroom.schoolId
          ? `These users are not learners in this school: ${invalid.join(', ')}`
          : `These users are not learners: ${invalid.join(', ')}`,
      );
    }
    const updated = (await this.classes.addStudents(
      classId,
      studentIds,
    )) as Classroom;
    const added = studentIds.filter(
      (id) => !classroom.studentUserIds.includes(id),
    );
    if (added.length) {
      await this.events.publish(
        new LearnersJoinedClass(classId, classroom.teacherUserId, added),
      );
    }
    return updated;
  }

  async removeStudent(
    actor: Actor,
    classId: string,
    studentId: string,
  ): Promise<Classroom> {
    assertCanManageClass(actor, await this.require(classId));
    return (await this.classes.removeStudent(classId, studentId)) as Classroom;
  }

  async joinWithCode(
    actor: Actor,
    code: string,
    ip?: string,
  ): Promise<Classroom> {
    if (actor.role !== UserRole.LEARNER)
      throw new ForbiddenError('Only learners join classes');
    const classroom = await this.classes.findByJoinCode(
      code.trim().toUpperCase(),
    );
    if (!classroom || classroom.isArchived)
      throw new NotFoundError('Invalid class code');
    if (classroom.schoolId && classroom.schoolId !== actor.schoolId) {
      throw new ForbiddenError('Join this school first, then the class');
    }
    if (classroom.studentUserIds.includes(actor.userId)) {
      throw new ConflictError('You are already in this class');
    }
    const updated = (await this.classes.addStudents(classroom.id, [
      actor.userId,
    ])) as Classroom;
    await this.events.publish(
      new LearnersJoinedClass(
        classroom.id,
        classroom.teacherUserId,
        [actor.userId],
        ip,
      ),
    );
    return updated;
  }

  async leave(actor: Actor, classId: string): Promise<void> {
    await this.classes.removeStudent(classId, actor.userId);
  }

  /**
   * A class can use Public courses, the class teacher's own courses and
   * courses shared with its school. Another teacher's Private course stays
   * private.
   */
  async assignCourse(actor: Actor, classId: string, courseId: string) {
    const classroom = await this.require(classId);
    assertCanManageClass(actor, classroom);
    const course = await this.catalog.getPublishedCourse(courseId);
    if (!canUseCourseInClass(actor, classroom, course)) {
      throw new ForbiddenError(
        "This is another teacher's private course. Ask them to share it.",
      );
    }
    return this.classes.addCourse(classId, courseId);
  }

  async unassignCourse(actor: Actor, classId: string, courseId: string) {
    assertCanManageClass(actor, await this.require(classId));
    return this.classes.removeCourse(classId, courseId);
  }

  async rotateJoinCode(actor: Actor, classId: string) {
    assertCanManageClass(actor, await this.require(classId));
    return this.classes.update(classId, { joinCode: randomCode(8) });
  }

  async announce(actor: Actor, classId: string, title: string, body: string) {
    const classroom = await this.require(classId);
    assertCanManageClass(actor, classroom);
    if (!STAFF_ROLES.includes(actor.role)) {
      await this.events.publish(
        new LearnerFacingTextSaved(
          actor.userId,
          actor.role,
          'announcement',
          classroom.id,
          `${title}\n${body}`,
        ),
      );
    }
    await this.events.publish(
      new ClassAnnouncementPosted(
        classroom.id,
        classroom.name,
        classroom.studentUserIds,
        title,
        body,
      ),
    );
    return { delivered: classroom.studentUserIds.length };
  }

  // ---- Facade -------------------------------------------------------------

  async requireManaged(actor: Actor, classId: string): Promise<Classroom> {
    const classroom = await this.require(classId);
    assertCanManageClass(actor, classroom);
    return classroom;
  }

  async requireViewable(actor: Actor, classId: string): Promise<Classroom> {
    const classroom = await this.require(classId);
    if (!canViewClass(actor, classroom))
      throw new ForbiddenError('You cannot view this class');
    return classroom;
  }

  findById(classId: string): Promise<Classroom | null> {
    return this.classes.findById(classId);
  }

  listForTeacher(teacherUserId: string) {
    return this.classes.listAll({ teacherUserId });
  }

  listForSchool(schoolId: string) {
    return this.classes.listAll({ schoolId });
  }

  listForStudent(studentUserId: string) {
    return this.classes.listAll({ studentUserId });
  }

  /** Whether a learner is in any class that has this course assigned. */
  async isCourseAssignedToLearner(
    learnerId: string,
    courseId: string,
  ): Promise<boolean> {
    return (
      (
        await this.classes.listAll({
          studentUserId: learnerId,
          assignedCourseId: courseId,
        })
      ).length > 0
    );
  }

  async isTeacherOfStudent(
    teacherUserId: string,
    studentUserId: string,
  ): Promise<boolean> {
    return (
      (await this.classes.listAll({ teacherUserId, studentUserId })).length > 0
    );
  }

  removeUserFromSchoolClasses(schoolId: string, userId: string) {
    return this.classes.removeUserFromSchoolClasses(schoolId, userId);
  }

  removeStudentEverywhere(userId: string) {
    return this.classes.removeStudentEverywhere(userId);
  }

  countClasses(filter: ClassroomFilter) {
    return this.classes.count(filter);
  }

  private async require(classId: string): Promise<Classroom> {
    const classroom = await this.classes.findById(classId);
    if (!classroom) throw new NotFoundError('Class not found');
    return classroom;
  }

  private async assertTeacherInSchool(
    teacherUserId: string,
    schoolId: string | null,
    anySchool = false,
  ) {
    const teacher: PublicUser | null = await this.users.findById(teacherUserId);
    if (
      !teacher ||
      teacher.role !== UserRole.TEACHER ||
      (!anySchool && (teacher.schoolId ?? null) !== schoolId)
    ) {
      throw new ValidationError(
        'teacherUserId must be a teacher in the same school',
      );
    }
  }
}

function canUseCourseInClass(
  actor: Actor,
  classroom: Classroom,
  course: Course,
): boolean {
  return (
    STAFF_ROLES.includes(actor.role) ||
    course.visibility === CourseVisibility.PUBLIC ||
    course.createdByUserId === classroom.teacherUserId ||
    course.createdByUserId === actor.userId ||
    (!!course.schoolId && course.schoolId === classroom.schoolId)
  );
}
