import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type LearningModuleDocument = HydratedDocument<LearningModule>;

@Schema({ timestamps: true, collection: 'learning_modules' })
export class LearningModule {
  @Prop({ type: Types.ObjectId, required: true, index: true })
  courseId!: Types.ObjectId;

  @Prop({ required: true })
  title!: string;

  @Prop({ default: 0 })
  order!: number;
}

export const LearningModuleSchema =
  SchemaFactory.createForClass(LearningModule);
