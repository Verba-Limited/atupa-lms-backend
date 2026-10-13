import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { AssignmentStatus } from '../../../common/enums/assignment-status.enum';

export type AssignmentDocument = HydratedDocument<Assignment>;

@Schema({ timestamps: true, collection: 'assignments' })
export class Assignment {
  @Prop({ required: true, index: true })
  classroomId!: string;

  @Prop({ required: true, index: true })
  teacherUserId!: string;

  @Prop({ required: true })
  title!: string;

  @Prop({ required: true })
  type!:
    | 'lesson'
    | 'quiz'
    | 'vocabulary'
    | 'audio'
    | 'game'
    | 'cultural_research'
    | 'written_work';

  @Prop()
  targetId?: string;

  @Prop({ type: Object, default: {} })
  learnerStatuses!: Record<string, AssignmentStatus>;

  @Prop({ type: Object, default: {} })
  submissions!: Record<string, Record<string, unknown>>;
}

export const AssignmentSchema = SchemaFactory.createForClass(Assignment);
