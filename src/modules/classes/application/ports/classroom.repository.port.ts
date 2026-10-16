import { CrudPort } from '../../../../shared/application/crud.port';
import { Page, PageRequest } from '../../../../shared/domain/pagination';
import { Classroom } from '../../domain/classroom.entity';

export const CLASSROOM_REPOSITORY = Symbol('CLASSROOM_REPOSITORY');

export interface ClassroomFilter {
  schoolId?: string;
  teacherUserId?: string;
  studentUserId?: string;
  includeArchived?: boolean;
}

export interface ClassroomRepository extends CrudPort<Classroom> {
  list(filter: ClassroomFilter, page: PageRequest): Promise<Page<Classroom>>;
  listAll(filter: ClassroomFilter): Promise<Classroom[]>;
  findByJoinCode(code: string): Promise<Classroom | null>;
  addStudents(id: string, studentIds: string[]): Promise<Classroom | null>;
  removeStudent(id: string, studentId: string): Promise<Classroom | null>;
  addCourse(id: string, courseId: string): Promise<Classroom | null>;
  removeCourse(id: string, courseId: string): Promise<Classroom | null>;
  removeUserFromSchoolClasses(schoolId: string, userId: string): Promise<void>;
  removeStudentEverywhere(userId: string): Promise<void>;
  count(filter: ClassroomFilter): Promise<number>;
}
