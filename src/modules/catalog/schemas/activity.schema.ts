import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type ActivityDocument = HydratedDocument<Activity>;

export enum ActivityType {
  MATCHING = 'matching',
  MULTIPLE_CHOICE = 'multiple_choice',
  FILL_BLANK = 'fill_blank',
  DRAG_DROP = 'drag_drop',
  WORD_ARRANGEMENT = 'word_arrangement',
  LISTENING = 'listening',
  PICTURE_ID = 'picture_id',
  FLASHCARDS = 'flashcards',
}

@Schema({ timestamps: true, collection: 'activities' })
export class Activity {
  @Prop({ type: Types.ObjectId, required: true, index: true })
  lessonId!: Types.ObjectId;

  @Prop({ required: true, enum: ActivityType, type: String })
  type!: ActivityType;

  @Prop({ type: Object, required: true })
  payload!: Record<string, unknown>;

  @Prop({ default: 0 })
  order!: number;
}

export const ActivitySchema = SchemaFactory.createForClass(Activity);
