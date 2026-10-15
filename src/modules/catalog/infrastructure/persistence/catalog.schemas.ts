import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Schema as MongooseSchema } from 'mongoose';
import {
  ContentStatus,
  ProficiencyLevel,
} from '../../../../shared/domain/enums';
import { ActivityType } from '../../domain/activity.entity';
import { AgeGroup, CourseType } from '../../domain/course.entity';
import { LessonBlockType } from '../../domain/lesson.entity';
import { QuestionType } from '../../domain/quiz.entity';

@Schema({ timestamps: true, collection: 'languages' })
export class LanguageRecord {
  @Prop({ required: true, unique: true, lowercase: true, trim: true })
  code!: string;

  @Prop({ required: true })
  name!: string;

  @Prop()
  nativeName?: string;

  @Prop({ default: true })
  isActive!: boolean;

  @Prop({ default: 0 })
  order!: number;
}
export const LanguageSchema = SchemaFactory.createForClass(LanguageRecord);

@Schema({ timestamps: true, collection: 'courses' })
export class CourseRecord {
  @Prop({ required: true, index: true, lowercase: true })
  languageCode!: string;

  @Prop({ required: true, enum: ProficiencyLevel, type: String, index: true })
  level!: ProficiencyLevel;

  @Prop({ required: true, trim: true })
  title!: string;

  @Prop()
  description?: string;

  @Prop({
    enum: CourseType,
    type: String,
    default: CourseType.LANGUAGE,
    index: true,
  })
  courseType!: CourseType;

  @Prop({ enum: AgeGroup, type: String, default: AgeGroup.ALL })
  ageGroup!: AgeGroup;

  @Prop()
  durationMinutes?: number;

  @Prop({ default: false })
  isPremium!: boolean;

  @Prop()
  coverImageUrl?: string;

  @Prop({ type: [String], default: [] })
  tags!: string[];

  @Prop({
    enum: ContentStatus,
    type: String,
    default: ContentStatus.DRAFT,
    index: true,
  })
  status!: ContentStatus;

  @Prop({ index: true })
  createdByUserId?: string;

  @Prop({ type: String, default: null, index: true })
  schoolId?: string | null;

  @Prop({ type: Date, default: null })
  publishedAt?: Date | null;
}
export const CourseSchema = SchemaFactory.createForClass(CourseRecord);
CourseSchema.index({ title: 'text', description: 'text', tags: 'text' });

@Schema({ timestamps: true, collection: 'learning_modules' })
export class CourseModuleRecord {
  @Prop({ required: true, index: true })
  courseId!: string;

  @Prop({ required: true })
  title!: string;

  @Prop()
  description?: string;

  @Prop({ default: 0 })
  order!: number;
}
export const CourseModuleSchema =
  SchemaFactory.createForClass(CourseModuleRecord);

@Schema({ _id: false })
export class LessonBlockRecord {
  @Prop({ required: true, enum: LessonBlockType, type: String })
  type!: LessonBlockType;

  @Prop()
  content?: string;

  @Prop()
  mediaUrl?: string;

  @Prop()
  mediaAssetId?: string;

  @Prop()
  refId?: string;

  @Prop({ type: MongooseSchema.Types.Mixed })
  data?: Record<string, unknown>;
}
const LessonBlockSchema = SchemaFactory.createForClass(LessonBlockRecord);

@Schema({ timestamps: true, collection: 'lessons' })
export class LessonRecord {
  @Prop({ required: true, index: true })
  courseId!: string;

  @Prop({ required: true, index: true })
  moduleId!: string;

  @Prop({ required: true })
  title!: string;

  @Prop()
  summary?: string;

  @Prop({ type: [LessonBlockSchema], default: [] })
  blocks!: LessonBlockRecord[];

  @Prop({ type: [String], default: [] })
  vocabulary!: string[];

  @Prop({ type: [String], default: [] })
  vocabularyIds!: string[];

  @Prop({ type: [String], default: [] })
  pronunciationNotes!: string[];

  @Prop({ type: [String], default: [] })
  culturalNotes!: string[];

  @Prop({ type: [String], default: [], index: true })
  gamecardCodes!: string[];

  @Prop()
  estimatedMinutes?: number;

  @Prop({
    enum: ContentStatus,
    type: String,
    default: ContentStatus.DRAFT,
    index: true,
  })
  status!: ContentStatus;

  @Prop({ default: 0 })
  order!: number;
}
export const LessonSchema = SchemaFactory.createForClass(LessonRecord);

@Schema({ timestamps: true, collection: 'activities' })
export class ActivityRecord {
  @Prop({ required: true, index: true })
  courseId!: string;

  @Prop({ required: true, index: true })
  lessonId!: string;

  @Prop({ required: true, enum: ActivityType, type: String })
  type!: ActivityType;

  @Prop()
  prompt?: string;

  @Prop({ type: MongooseSchema.Types.Mixed, default: {} })
  payload!: Record<string, unknown>;

  @Prop({ type: MongooseSchema.Types.Mixed })
  solution?: unknown;

  @Prop({ default: false })
  ordered?: boolean;

  @Prop({ type: MongooseSchema.Types.Mixed })
  feedback?: { correct?: string; incorrect?: string };

  @Prop({ default: 0 })
  order!: number;
}
export const ActivitySchema = SchemaFactory.createForClass(ActivityRecord);

@Schema({ _id: false })
export class QuizQuestionRecord {
  @Prop({ required: true })
  id!: string;

  @Prop({ required: true, enum: QuestionType, type: String })
  type!: QuestionType;

  @Prop({ required: true })
  prompt!: string;

  @Prop()
  mediaUrl?: string;

  @Prop({ type: MongooseSchema.Types.Mixed })
  options?: Record<string, unknown>;

  @Prop({ type: MongooseSchema.Types.Mixed, required: true })
  correctAnswer!: unknown;

  @Prop({ type: [String], default: undefined })
  acceptedAnswers?: string[];

  @Prop()
  ordered?: boolean;

  @Prop()
  explanation?: string;

  @Prop({ default: 1 })
  points!: number;
}
const QuizQuestionSchema = SchemaFactory.createForClass(QuizQuestionRecord);

@Schema({ timestamps: true, collection: 'quizzes' })
export class QuizRecord {
  @Prop({ required: true, index: true })
  courseId!: string;

  @Prop({ index: true })
  moduleId?: string;

  @Prop({ index: true })
  lessonId?: string;

  @Prop({ required: true })
  title!: string;

  @Prop()
  description?: string;

  @Prop({ type: [QuizQuestionSchema], default: [] })
  questions!: QuizQuestionRecord[];

  @Prop({ default: 70 })
  passScorePercent!: number;

  @Prop()
  timerSeconds?: number;

  @Prop({ default: false })
  randomizeQuestions!: boolean;

  @Prop()
  maxAttempts?: number;

  @Prop({ default: true })
  allowReview!: boolean;
}
export const QuizSchema = SchemaFactory.createForClass(QuizRecord);
