import { Inject, Injectable } from '@nestjs/common';
import type { Actor } from '../../../shared/application/actor';
import type { EventBus } from '../../../shared/application/event-bus.port';
import { EVENT_BUS } from '../../../shared/application/event-bus.port';
import {
  AssignmentCreated,
  AssignmentReviewed,
} from '../../../shared/contracts/events';
import {
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from '../../../shared/domain/errors';
import { mapPage, Page, PageRequest } from '../../../shared/domain/pagination';
import { UserRole } from '../../../shared/domain/user-role';
import { CatalogQueryService } from '../../catalog';
import { canManageClass, Classroom, ClassesService } from '../../classes';
import { LibraryService } from '../../library';
import {
  Assignment,
  AssignmentStatus,
  AssignmentType,
  assertLearnerTransition,
  assertReviewable,
  Submission,
  TARGETED_TYPES,
} from '../domain/assignment.entities';
import type {
  AssignmentRepository,
  SubmissionRepository,
} from './ports/assignment.ports';
import {
  ASSIGNMENT_REPOSITORY,
  SUBMISSION_REPOSITORY,
} from './ports/assignment.ports';

export interface CreateAssignmentInput {
  classroomId: string;
  title: string;
  instructions?: string;
  type: AssignmentType;
  targetId?: string;
  dueAt?: Date;
  maxScore?: number;
  /** Defaults to every student in the class. */
  learnerIds?: string[];
}

@Injectable()
export class AssignmentsService {
  constructor(
    @Inject(ASSIGNMENT_REPOSITORY)
    private readonly assignments: AssignmentRepository,
    @Inject(SUBMISSION_REPOSITORY)
    private readonly submissions: SubmissionRepository,
    @Inject(EVENT_BUS) private readonly events: EventBus,
    private readonly classes: ClassesService,
    private readonly catalog: CatalogQueryService,
    private readonly library: LibraryService,
  ) {}

  async create(
    actor: Actor,
    input: CreateAssignmentInput,
  ): Promise<Assignment> {
    const classroom = await this.classes.requireManaged(
      actor,
      input.classroomId,
    );
    const learnerIds = input.learnerIds?.length
      ? input.learnerIds
      : classroom.studentUserIds;
    if (!learnerIds.length)
      throw new ValidationError('This class has no students yet');
    const outsiders = learnerIds.filter(
      (id) => !classroom.studentUserIds.includes(id),
    );
    if (outsiders.length) {
      throw new ValidationError(
        `Not students of this class: ${outsiders.join(', ')}`,
      );
    }
    await this.assertTarget(input.type, input.targetId);

    const assignment = await this.assignments.create({
      classroomId: classroom.id,
      schoolId: classroom.schoolId,
      createdByUserId: actor.userId,
      title: input.title,
      instructions: input.instructions,
      type: input.type,
      targetId: input.targetId,
      dueAt: input.dueAt,
      maxScore: input.maxScore,
      learnerIds,
    });
    await this.submissions.createMany(
      learnerIds.map((learnerId) => ({
        assignmentId: assignment.id,
        classroomId: classroom.id,
        learnerId,
        status: AssignmentStatus.ASSIGNED,
        mediaUrls: [],
      })),
    );
    await this.events.publish(
      new AssignmentCreated(
        assignment.id,
        assignment.title,
        learnerIds,
        assignment.dueAt,
      ),
    );
    return assignment;
  }

  async listForClass(actor: Actor, classroomId: string, page: PageRequest) {
    const classroom = await this.classes.requireViewable(actor, classroomId);
    const isLearner = actor.role === UserRole.LEARNER;
    const result = await this.assignments.listByClass(
      classroomId,
      page,
      isLearner ? actor.userId : undefined,
    );
    if (isLearner) {
      const mine = await Promise.all(
        result.items.map((a) => this.submissions.find(a.id, actor.userId)),
      );
      return mapPage(result, (a) => ({
        ...this.forLearner(a),
        submission: mine.find((s) => s?.assignmentId === a.id) ?? null,
      }));
    }
    this.assertManager(actor, classroom);
    const counts = await Promise.all(
      result.items.map((a) =>
        this.submissions.countByStatus({ assignmentIds: [a.id] }),
      ),
    );
    return mapPage(result, (a) => ({
      ...a,
      statusCounts: counts[result.items.indexOf(a)],
    }));
  }

  async listMine(actor: Actor, page: PageRequest): Promise<Page<unknown>> {
    const submissions = await this.submissions.listByLearner(
      actor.userId,
      page,
    );
    const assignments = await this.assignments.findByIds(
      submissions.items.map((s) => s.assignmentId),
    );
    const byId = new Map(assignments.map((a) => [a.id, a]));
    return mapPage(submissions, (s) => ({
      submission: s,
      assignment: byId.has(s.assignmentId)
        ? this.forLearner(byId.get(s.assignmentId)!)
        : null,
    }));
  }

  async get(actor: Actor, assignmentId: string) {
    const assignment = await this.require(assignmentId);
    const classroom = await this.classes.requireViewable(
      actor,
      assignment.classroomId,
    );
    if (actor.role === UserRole.LEARNER) {
      return {
        assignment: this.forLearner(assignment),
        submission: await this.submissions.find(assignmentId, actor.userId),
      };
    }
    this.assertManager(actor, classroom);
    return {
      assignment,
      submissions: await this.submissions.listByAssignment(assignmentId),
    };
  }

  async start(actor: Actor, assignmentId: string): Promise<Submission> {
    const submission = await this.requireOwnSubmission(actor, assignmentId);
    assertLearnerTransition(submission.status, AssignmentStatus.STARTED);
    return this.transitionOrFail(
      assignmentId,
      actor.userId,
      [submission.status],
      {
        status: AssignmentStatus.STARTED,
        startedAt: new Date(),
      },
    );
  }

  async submit(
    actor: Actor,
    assignmentId: string,
    work: { text?: string; mediaUrls?: string[] },
  ): Promise<Submission> {
    const submission = await this.requireOwnSubmission(actor, assignmentId);
    assertLearnerTransition(submission.status, AssignmentStatus.SUBMITTED);
    if (!work.text?.trim() && !work.mediaUrls?.length) {
      throw new ValidationError('Add some text or a recording/image to submit');
    }
    return this.transitionOrFail(
      assignmentId,
      actor.userId,
      [submission.status],
      {
        status: AssignmentStatus.SUBMITTED,
        text: work.text,
        mediaUrls: work.mediaUrls ?? [],
        startedAt: submission.startedAt ?? new Date(),
        submittedAt: new Date(),
      },
    );
  }

  async review(
    actor: Actor,
    assignmentId: string,
    learnerId: string,
    review: { score?: number; feedback?: string; complete?: boolean },
  ): Promise<Submission> {
    const assignment = await this.require(assignmentId);
    await this.classes.requireManaged(actor, assignment.classroomId);
    const submission = await this.submissions.find(assignmentId, learnerId);
    if (!submission)
      throw new NotFoundError(
        'This learner has no submission for the assignment',
      );
    assertReviewable(submission.status);
    if (
      review.score !== undefined &&
      assignment.maxScore !== undefined &&
      review.score > assignment.maxScore
    ) {
      throw new ValidationError(`Score cannot exceed ${assignment.maxScore}`);
    }
    const now = new Date();
    const updated = await this.transitionOrFail(
      assignmentId,
      learnerId,
      [submission.status],
      {
        status: review.complete
          ? AssignmentStatus.COMPLETED
          : AssignmentStatus.REVIEWED,
        score: review.score,
        feedback: review.feedback,
        reviewedAt: now,
        reviewedByUserId: actor.userId,
        ...(review.complete ? { completedAt: now } : {}),
      },
    );
    await this.events.publish(
      new AssignmentReviewed(
        assignment.id,
        assignment.title,
        learnerId,
        review.score,
        review.feedback,
      ),
    );
    return updated;
  }

  async remove(actor: Actor, assignmentId: string): Promise<void> {
    const assignment = await this.require(assignmentId);
    await this.classes.requireManaged(actor, assignment.classroomId);
    await this.submissions.deleteByAssignment(assignmentId);
    await this.assignments.delete(assignmentId);
  }

  /** Lesson/quiz/game assignments complete when the learner finishes the target. */
  async autoComplete(
    learnerId: string,
    type: AssignmentType,
    targetId: string,
  ): Promise<void> {
    const matches = await this.assignments.findByTarget(
      learnerId,
      type,
      targetId,
    );
    const now = new Date();
    for (const assignment of matches) {
      await this.submissions.transition(
        assignment.id,
        learnerId,
        [AssignmentStatus.ASSIGNED, AssignmentStatus.STARTED],
        {
          status: AssignmentStatus.COMPLETED,
          completedAt: now,
          submittedAt: now,
        },
      );
    }
  }

  // ---- Facade for reports ---------------------------------------------------

  listSubmissionsForLearners(learnerIds: string[], limit = 100) {
    return this.submissions.listByLearners(learnerIds, limit);
  }

  findAssignments(ids: string[]) {
    return this.assignments.findByIds(ids);
  }

  countAssignments(filter: { classroomIds?: string[]; schoolId?: string }) {
    return this.assignments.count(filter);
  }

  countSubmissionsByStatus(filter: { learnerIds?: string[] }) {
    return this.submissions.countByStatus(filter);
  }

  private forLearner(assignment: Assignment) {
    const { learnerIds, ...rest } = assignment;
    void learnerIds;
    return rest;
  }

  private assertManager(actor: Actor, classroom: Classroom) {
    if (!canManageClass(actor, classroom))
      throw new ForbiddenError('You do not manage this class');
  }

  private async assertTarget(type: AssignmentType, targetId?: string) {
    if (!TARGETED_TYPES.includes(type)) return;
    if (!targetId)
      throw new ValidationError(`${type} assignments need a targetId`);
    if (type === AssignmentType.LESSON)
      await this.catalog.getLearnerLesson(targetId);
    if (type === AssignmentType.QUIZ)
      await this.catalog.getQuizForGrading(targetId);
    if (type === AssignmentType.GAME) await this.library.getGame(targetId);
  }

  private async require(id: string): Promise<Assignment> {
    const assignment = await this.assignments.findById(id);
    if (!assignment) throw new NotFoundError('Assignment not found');
    return assignment;
  }

  private async requireOwnSubmission(
    actor: Actor,
    assignmentId: string,
  ): Promise<Submission> {
    if (actor.role !== UserRole.LEARNER)
      throw new ForbiddenError('Only learners work on assignments');
    const submission = await this.submissions.find(assignmentId, actor.userId);
    if (!submission) throw new NotFoundError('Assignment not found');
    return submission;
  }

  private async transitionOrFail(
    assignmentId: string,
    learnerId: string,
    from: AssignmentStatus[],
    patch: Partial<Submission>,
  ): Promise<Submission> {
    const updated = await this.submissions.transition(
      assignmentId,
      learnerId,
      from,
      patch,
    );
    if (!updated)
      throw new ValidationError(
        'The assignment changed meanwhile, please refresh',
      );
    return updated;
  }
}
