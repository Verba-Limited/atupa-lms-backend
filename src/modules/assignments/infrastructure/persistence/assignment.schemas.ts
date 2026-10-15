import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import {
  AssignmentStatus,
  AssignmentType,
} from '../../domain/assignment.entities';

@Schema({ timestamps: true, collection: 'class_assignments' })
export class AssignmentRecord {
  @Prop({ required: true, index: true }) classroomId!: string;
  @Prop({ type: String, default: null, index: true }) schoolId!: string | null;
  @Prop({ required: true }) createdByUserId!: string;
  @Prop({ required: true }) title!: string;
  @Prop() instructions?: string;
  @Prop({ required: true, enum: AssignmentType, type: String })
  type!: AssignmentType;
  @Prop() targetId?: string;
  @Prop() dueAt?: Date;
  @Prop() maxScore?: number;
  @Prop({ type: [String], default: [], index: true }) learnerIds!: string[];
}
export const AssignmentSchema = SchemaFactory.createForClass(AssignmentRecord);
AssignmentSchema.index({ type: 1, targetId: 1 });

@Schema({ timestamps: true, collection: 'assignment_submissions' })
export class SubmissionRecord {
  @Prop({ required: true }) assignmentId!: string;
  @Prop({ required: true }) classroomId!: string;
  @Prop({ required: true, index: true }) learnerId!: string;
  @Prop({ required: true, enum: AssignmentStatus, type: String })
  status!: AssignmentStatus;
  @Prop() text?: string;
  @Prop({ type: [String], default: [] }) mediaUrls!: string[];
  @Prop() score?: number;
  @Prop() feedback?: string;
  @Prop() startedAt?: Date;
  @Prop() submittedAt?: Date;
  @Prop() reviewedAt?: Date;
  @Prop() reviewedByUserId?: string;
  @Prop() completedAt?: Date;
}
export const SubmissionSchema = SchemaFactory.createForClass(SubmissionRecord);
SubmissionSchema.index({ assignmentId: 1, learnerId: 1 }, { unique: true });
