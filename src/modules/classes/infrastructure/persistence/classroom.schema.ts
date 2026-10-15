import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

@Schema({ timestamps: true, collection: 'classrooms' })
export class ClassroomRecord {
  @Prop({ type: String, default: null, index: true }) schoolId!: string | null;
  @Prop({ required: true, trim: true }) name!: string;
  @Prop() description?: string;
  @Prop({ lowercase: true }) languageCode?: string;
  @Prop({ required: true, index: true }) teacherUserId!: string;
  @Prop({ type: [String], default: [], index: true }) studentUserIds!: string[];
  @Prop({ type: [String], default: [] }) assignedCourseIds!: string[];
  @Prop({ required: true, unique: true, uppercase: true }) joinCode!: string;
  @Prop({ default: false }) isArchived!: boolean;
}
export const ClassroomSchema = SchemaFactory.createForClass(ClassroomRecord);
