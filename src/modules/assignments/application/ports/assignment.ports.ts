import { CrudPort } from '../../../../shared/application/crud.port';
import { Page, PageRequest } from '../../../../shared/domain/pagination';
import {
  Assignment,
  AssignmentStatus,
  AssignmentType,
  Submission,
} from '../../domain/assignment.entities';

export const ASSIGNMENT_REPOSITORY = Symbol('ASSIGNMENT_REPOSITORY');
export const SUBMISSION_REPOSITORY = Symbol('SUBMISSION_REPOSITORY');

export interface AssignmentRepository extends CrudPort<Assignment> {
  listByClass(
    classroomId: string,
    page: PageRequest,
    learnerId?: string,
  ): Promise<Page<Assignment>>;
  findByTarget(
    learnerId: string,
    type: AssignmentType,
    targetId: string,
  ): Promise<Assignment[]>;
  count(filter: {
    classroomIds?: string[];
    schoolId?: string;
  }): Promise<number>;
}

export interface SubmissionRepository {
  createMany(items: Omit<Submission, 'id'>[]): Promise<void>;
  find(assignmentId: string, learnerId: string): Promise<Submission | null>;
  listByAssignment(assignmentId: string): Promise<Submission[]>;
  listByAssignments(assignmentIds: string[]): Promise<Submission[]>;
  listByLearner(
    learnerId: string,
    page: PageRequest,
  ): Promise<Page<Submission>>;
  listByLearners(learnerIds: string[], limit: number): Promise<Submission[]>;
  /** Updates only if the submission is still in one of `fromStatuses`. */
  transition(
    assignmentId: string,
    learnerId: string,
    fromStatuses: AssignmentStatus[],
    patch: Partial<Submission>,
  ): Promise<Submission | null>;
  deleteByAssignment(assignmentId: string): Promise<void>;
  countByStatus(filter: {
    assignmentIds?: string[];
    learnerIds?: string[];
  }): Promise<Record<string, number>>;
}
