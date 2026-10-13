import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { AssignmentStatus } from '../../common/enums/assignment-status.enum';
import { Assignment, AssignmentDocument } from './schemas/assignment.schema';

@Injectable()
export class AssignmentsService {
  constructor(
    @InjectModel(Assignment.name)
    private readonly assignmentModel: Model<Assignment>,
  ) {}

  create(input: {
    classroomId: string;
    teacherUserId: string;
    title: string;
    type: Assignment['type'];
    targetId?: string;
    learnerIds: string[];
  }) {
    const learnerStatuses = Object.fromEntries(
      input.learnerIds.map((id) => [id, AssignmentStatus.ASSIGNED]),
    );
    return this.assignmentModel.create({
      classroomId: input.classroomId,
      teacherUserId: input.teacherUserId,
      title: input.title,
      type: input.type,
      targetId: input.targetId,
      learnerStatuses,
    });
  }

  async updateStatus(
    assignmentId: string,
    learnerId: string,
    status: AssignmentStatus,
    submission?: Record<string, unknown>,
  ) {
    const assignment = await this.assignmentModel.findById(assignmentId).exec();
    if (!assignment) throw new NotFoundException('Assignment not found');
    assignment.learnerStatuses[learnerId] = status;
    if (submission) assignment.submissions[learnerId] = submission;
    await assignment.save();
    return assignment;
  }

  listForClassroom(classroomId: string): Promise<AssignmentDocument[]> {
    return this.assignmentModel.find({ classroomId }).sort({ createdAt: -1 }).exec();
  }
}
