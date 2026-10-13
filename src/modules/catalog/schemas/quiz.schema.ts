import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';

export type QuizDocument = HydratedDocument<Quiz>;

export enum QuestionType {
  MULTIPLE_CHOICE = 'multiple_choice',
  TRUE_FALSE = 'true_false',
  MATCHING = 'matching',
  FILL_BLANK = 'fill_blank',
  IMAGE = 'image',
  AUDIO = 'audio',
  TRANSLATION = 'translation',
  VOCABULARY = 'vocabulary',
}

@Schema({ _id: false })
export class QuizQuestion {
  @Prop({ required: true, enum: QuestionType, type: String })
  type!: QuestionType;

  @Prop({ required: true })
  prompt!: string;

  @Prop({ type: Object, required: true })
  options!: Record<string, unknown>;

  @Prop({ type: MongooseSchema.Types.Mixed, required: true })
  correctAnswer!: string | string[] | Record<string, string>;
}

@Schema({ timestamps: true, collection: 'quizzes' })
export class Quiz {
  @Prop({ type: Types.ObjectId, required: true, index: true })
  lessonId!: Types.ObjectId;

  @Prop({ required: true })
  title!: string;

  @Prop({ type: [QuizQuestion], default: [] })
  questions!: QuizQuestion[];

  @Prop({ default: 70 })
  passScorePercent!: number;

  @Prop()
  timerSeconds?: number;

  @Prop({ default: false })
  randomizeQuestions!: boolean;
}

export const QuizSchema = SchemaFactory.createForClass(Quiz);
