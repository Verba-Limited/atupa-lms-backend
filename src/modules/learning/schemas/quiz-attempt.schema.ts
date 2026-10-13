import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type QuizAttemptDocument = HydratedDocument<QuizAttempt>;

@Schema({ timestamps: true, collection: 'quiz_attempts' })
export class QuizAttempt {
  @Prop({ required: true, index: true })
  userId!: string;

  @Prop({ type: Types.ObjectId, required: true, index: true })
  quizId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, required: true, index: true })
  lessonId!: Types.ObjectId;

  @Prop({ required: true })
  scorePercent!: number;

  @Prop({ required: true })
  passed!: boolean;

  @Prop({ type: Object, default: {} })
  answers!: Record<string, unknown>;

  @Prop()
  durationSeconds?: number;
}

export const QuizAttemptSchema = SchemaFactory.createForClass(QuizAttempt);
