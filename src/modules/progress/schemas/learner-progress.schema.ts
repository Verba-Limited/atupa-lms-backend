import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type LearnerProgressDocument = HydratedDocument<LearnerProgress>;

@Schema({ _id: false })
export class LessonProgressState {
  @Prop({ required: true })
  lessonId!: string;

  @Prop({ default: false })
  completed!: boolean;

  @Prop({ default: 0 })
  progressPercent!: number;

  @Prop()
  lastBlockIndex?: number;

  @Prop()
  lastActivityId?: string;

  @Prop()
  completedAt?: Date;
}

@Schema({ timestamps: true, collection: 'learner_progress' })
export class LearnerProgress {
  @Prop({ required: true, unique: true, index: true })
  userId!: string;

  @Prop({ default: 0 })
  totalPoints!: number;

  @Prop({ default: 0 })
  currentStreakDays!: number;

  @Prop()
  lastActivityDate?: string;

  @Prop({ type: [String], default: [] })
  earnedBadges!: string[];

  @Prop({ type: [LessonProgressState], default: [] })
  lessons!: LessonProgressState[];

  @Prop({ type: [String], default: [] })
  completedCourseIds!: string[];

  @Prop()
  continueCourseId?: string;

  @Prop()
  continueLessonId?: string;

  @Prop({ default: 0 })
  totalLearningMinutes!: number;

  @Prop({ type: [Object], default: [] })
  recentActivities!: Array<Record<string, unknown>>;
}

export const LearnerProgressSchema =
  SchemaFactory.createForClass(LearnerProgress);
