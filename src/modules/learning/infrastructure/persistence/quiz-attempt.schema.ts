import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Schema as MongooseSchema } from 'mongoose';

@Schema({ timestamps: true, collection: 'assessment_attempts' })
export class QuizAttemptRecord {
  @Prop({ required: true }) userId!: string;
  @Prop({ required: true }) quizId!: string;
  @Prop({ required: true, index: true }) courseId!: string;
  @Prop() lessonId?: string;
  @Prop({ type: [String], default: [] }) questionOrder!: string[];
  @Prop({ required: true, default: 'in_progress' }) status!: string;
  @Prop({ required: true }) startedAt!: Date;
  @Prop() expiresAt?: Date;
  @Prop() submittedAt?: Date;
  @Prop({ type: MongooseSchema.Types.Mixed, default: {} }) answers!: Record<
    string,
    unknown
  >;
  @Prop({
    type: [
      { questionId: String, correct: Boolean, points: Number, _id: false },
    ],
    default: [],
  })
  results!: Array<{ questionId: string; correct: boolean; points: number }>;
  @Prop({ default: 0 }) earnedPoints!: number;
  @Prop({ default: 0 }) totalPoints!: number;
  @Prop({ default: 0 }) scorePercent!: number;
  @Prop({ default: false }) passed!: boolean;
}
export const QuizAttemptSchema =
  SchemaFactory.createForClass(QuizAttemptRecord);
QuizAttemptSchema.index({ userId: 1, quizId: 1, status: 1 });
