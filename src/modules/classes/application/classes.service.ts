import { Inject, Injectable } from '@nestjs/common';
import type { Actor } from '../../../shared/application/actor';
import type { EventBus } from '../../../shared/application/event-bus.port';
import { EVENT_BUS } from '../../../shared/application/event-bus.port';
import { ClassAnnouncementPosted } from '../../../shared/contracts/events';
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from '../../../shared/domain/errors';
import { Page, PageRequest } from '../../../shared/domain/pagination';
import { randomCode } from '../../../shared/domain/random-code';
import { UserRole } from '../../../shared/domain/user-role';
import { CatalogQueryService } from '../../catalog';
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
        if (!input.schoolId || !input.teacherUserId) {
          throw new ValidationError('schoolId and teacherUserId are required');
        }
        schoolId = input.schoolId;
        teacherUserId = input.teacherUserId;
        break;
      default:
        throw new ForbiddenError('You cannot create classes');
    }
    if (teacherUserId !== actor.userId) {
      await this.assertTeacherInSchool(teacherUserId, schoolId);
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
    filter: { schoolId?: string },
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
        scoped.schoolId = filter.schoolId;
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
      actor.role !== UserRole.SUPER_ADMIN
    ) {
      throw new ForbiddenError(
        'Only school administrators can assign teachers',
      );
    }
    assertCanManageClass(actor, classroom);
    await this.assertTeacherInSchool(teacherUserId, classroom.schoolId);
    return this.classes.update(classId, { teacherUserId });
  }

  /**
   * Adds school members to a class. Learners outside the school (or for an
   * independent class) must join with the class code themselves.
   */
  async addStudents(
    actor: Actor,
    classId: string,
    studentIds: string[],
  ): Promise<Classroom> {
    const classroom = await this.require(classId);
    assertCanManageClass(actor, classroom);
    if (!classroom.schoolId) {
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
            s.schoolId === classroom.schoolId,
        ),
    );
    if (invalid.length) {
      throw new ValidationError(
        `These users are not learners in this school: ${invalid.join(', ')}`,
      );
    }
    return (await this.classes.addStudents(classId, studentIds)) as Classroom;
  }

  async removeStudent(
    actor: Actor,
    classId: string,
    studentId: string,
  ): Promise<Classroom> {
    assertCanManageClass(actor, await this.require(classId));
    return (await this.classes.removeStudent(classId, studentId)) as Classroom;
  }

  async joinWithCode(actor: Actor, code: string): Promise<Classroom> {
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
    return (await this.classes.addStudents(classroom.id, [
      actor.userId,
    ])) as Classroom;
  }

  async leave(actor: Actor, classId: string): Promise<void> {
    await this.classes.removeStudent(classId, actor.userId);
  }

  async assignCourse(actor: Actor, classId: string, courseId: string) {
    assertCanManageClass(actor, await this.require(classId));
    await this.catalog.getPublishedCourse(courseId);
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

  listForTeacher(teacherUserId: string) {
    return this.classes.listAll({ teacherUserId });
  }

  listForSchool(schoolId: string) {
    return this.classes.listAll({ schoolId });
  }

  listForStudent(studentUserId: string) {
    return this.classes.listAll({ studentUserId });
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
  ) {
    const teacher: PublicUser | null = await this.users.findById(teacherUserId);
    if (
      !teacher ||
      teacher.role !== UserRole.TEACHER ||
      (teacher.schoolId ?? null) !== schoolId
    ) {
      throw new ValidationError(
        'teacherUserId must be a teacher in the same school',
      );
    }
  }
}
