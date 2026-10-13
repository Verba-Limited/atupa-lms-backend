import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { ContentStatus } from '../../../common/enums/content-status.enum';

export type LessonDocument = HydratedDocument<Lesson>;

@Schema({ _id: false })
export class LessonBlock {
  @Prop({ required: true })
  type!: 'text' | 'image' | 'audio' | 'video';

  @Prop()
  content?: string;

  @Prop()
  mediaUrl?: string;
}

@Schema({ timestamps: true, collection: 'lessons' })
export class Lesson {
  @Prop({ type: Types.ObjectId, required: true, index: true })
  courseId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, required: true, index: true })
  moduleId!: Types.ObjectId;

  @Prop({ required: true })
  title!: string;

  @Prop({ type: [LessonBlock], default: [] })
  blocks!: LessonBlock[];

  @Prop({ type: [String], default: [] })
  vocabulary!: string[];

  @Prop({ type: [String], default: [] })
  pronunciationNotes!: string[];

  @Prop({ type: [String], default: [] })
  culturalNotes!: string[];

  @Prop({ enum: ContentStatus, type: String, default: ContentStatus.DRAFT })
  status!: ContentStatus;

  @Prop({ default: 0 })
  order!: number;

  @Prop()
  gamecardQrCode?: string;
}

export const LessonSchema = SchemaFactory.createForClass(Lesson);
