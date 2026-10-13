import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type ClassroomDocument = HydratedDocument<Classroom>;

@Schema({ timestamps: true, collection: 'classrooms' })
export class Classroom {
  @Prop({ required: true, index: true })
  schoolId!: string;

  @Prop({ required: true })
  name!: string;

  @Prop({ required: true, index: true })
  teacherUserId!: string;

  @Prop({ type: [String], default: [] })
  studentUserIds!: string[];

  @Prop({ type: [String], default: [] })
  assignedCourseIds!: string[];
}

export const ClassroomSchema = SchemaFactory.createForClass(Classroom);
