import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Schema as MongooseSchema } from 'mongoose';
import { LearningEventType } from '../../domain/progress.entities';

@Schema({ timestamps: true, collection: 'enrollments' })
export class EnrollmentRecord {
  @Prop({ required: true }) userId!: string;
  @Prop({ required: true, index: true }) courseId!: string;
  @Prop({ required: true }) languageCode!: string;
  @Prop({ required: true, default: 'active' }) status!: string;
  @Prop({ default: 0 }) progressPercent!: number;
  @Prop({ required: true }) enrolledAt!: Date;
  @Prop({ required: true }) lastAccessedAt!: Date;
  @Prop() completedAt?: Date;
}
export const EnrollmentSchema = SchemaFactory.createForClass(EnrollmentRecord);
EnrollmentSchema.index({ userId: 1, courseId: 1 }, { unique: true });
EnrollmentSchema.index({ userId: 1, lastAccessedAt: -1 });

@Schema({ timestamps: true, collection: 'lesson_progress' })
export class LessonProgressRecord {
  @Prop({ required: true }) userId!: string;
  @Prop({ required: true }) courseId!: string;
  @Prop({ required: true }) lessonId!: string;
  @Prop({ default: false }) completed!: boolean;
  @Prop({ default: 0 }) progressPercent!: number;
  @Prop() lastBlockIndex?: number;
  @Prop() lastActivityId?: string;
  @Prop() completedAt?: Date;
}
export const LessonProgressSchema =
  SchemaFactory.createForClass(LessonProgressRecord);
LessonProgressSchema.index({ userId: 1, lessonId: 1 }, { unique: true });
LessonProgressSchema.index({ userId: 1, courseId: 1 });
LessonProgressSchema.index({ userId: 1, updatedAt: -1 });

@Schema({ timestamps: true, collection: 'activity_completions' })
export class ActivityCompletionRecord {
  @Prop({ required: true }) userId!: string;
  @Prop({ required: true }) courseId!: string;
  @Prop({ required: true }) lessonId!: string;
  @Prop({ required: true }) activityId!: string;
  @Prop({ required: true }) correct!: boolean;
}
export const ActivityCompletionSchema = SchemaFactory.createForClass(
  ActivityCompletionRecord,
);
ActivityCompletionSchema.index({ userId: 1, activityId: 1 }, { unique: true });
ActivityCompletionSchema.index({ userId: 1, courseId: 1 });

@Schema({ timestamps: true, collection: 'quiz_results' })
export class QuizResultRecord {
  @Prop({ required: true }) userId!: string;
  @Prop({ required: true }) quizId!: string;
  @Prop({ required: true }) quizTitle!: string;
  @Prop({ required: true }) courseId!: string;
  @Prop({ required: true }) bestScorePercent!: number;
  @Prop({ required: true }) lastScorePercent!: number;
  @Prop({ default: false }) passed!: boolean;
  @Prop({ default: 0 }) attempts!: number;
  @Prop() passedAt?: Date;
  @Prop({ required: true }) lastAttemptAt!: Date;
}
export const QuizResultSchema = SchemaFactory.createForClass(QuizResultRecord);
QuizResultSchema.index({ userId: 1, quizId: 1 }, { unique: true });
QuizResultSchema.index({ userId: 1, courseId: 1 });

@Schema({ timestamps: true, collection: 'learner_stats' })
export class LearnerStatsRecord {
  @Prop({ required: true, unique: true }) userId!: string;
  @Prop({ default: 0 }) totalPoints!: number;
  @Prop({ default: 0 }) currentStreakDays!: number;
  @Prop({ default: 0 }) longestStreakDays!: number;
  @Prop({ index: true }) lastActiveDate?: string;
  @Prop({ default: 0 }) totalLearningSeconds!: number;
  @Prop() lastHeartbeatAt?: Date;
  @Prop({ type: [{ code: String, earnedAt: Date, _id: false }], default: [] })
  badges!: Array<{ code: string; earnedAt: Date }>;
  @Prop({
    type: {
      lessonsCompleted: { type: Number, default: 0 },
      activitiesCompleted: { type: Number, default: 0 },
      quizzesPassed: { type: Number, default: 0 },
      gamesPlayed: { type: Number, default: 0 },
      gamecardScans: { type: Number, default: 0 },
      culturalTopicsCompleted: { type: Number, default: 0 },
      coursesCompleted: { type: Number, default: 0 },
      _id: false,
    },
    default: {},
  })
  counters!: Record<string, number>;
  @Prop({ type: [String], default: [] }) languagesStarted!: string[];
}
export const LearnerStatsSchema =
  SchemaFactory.createForClass(LearnerStatsRecord);

@Schema({ collection: 'learning_events' })
export class LearningEventRecord {
  @Prop({ required: true }) userId!: string;
  @Prop({ required: true, enum: LearningEventType, type: String })
  type!: string;
  @Prop({ default: 0 }) points!: number;
  @Prop() courseId?: string;
  @Prop() lessonId?: string;
  @Prop() refId?: string;
  @Prop({ type: MongooseSchema.Types.Mixed }) meta?: Record<string, unknown>;
  @Prop({ required: true }) at!: Date;
}
export const LearningEventSchema =
  SchemaFactory.createForClass(LearningEventRecord);
LearningEventSchema.index({ userId: 1, at: -1 });
LearningEventSchema.index({ at: -1, type: 1 });
