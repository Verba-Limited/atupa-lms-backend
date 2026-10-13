import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { ContentStatus } from '../../../common/enums/content-status.enum';
import { ProficiencyLevel } from '../../../common/enums/proficiency-level.enum';

export type CourseDocument = HydratedDocument<Course>;

@Schema({ timestamps: true, collection: 'courses' })
export class Course {
  @Prop({ required: true, index: true })
  languageCode!: string;

  @Prop({ required: true, enum: ProficiencyLevel, type: String, index: true })
  level!: ProficiencyLevel;

  @Prop({ required: true })
  title!: string;

  @Prop()
  description?: string;

  @Prop({
    enum: ContentStatus,
    type: String,
    default: ContentStatus.DRAFT,
    index: true,
  })
  status!: ContentStatus;

  @Prop()
  ageGroup?: string;

  @Prop()
  durationMinutes?: number;

  @Prop()
  createdByUserId?: string;
}

export const CourseSchema = SchemaFactory.createForClass(Course);
