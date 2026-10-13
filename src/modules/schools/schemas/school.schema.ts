import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type SchoolDocument = HydratedDocument<School>;

@Schema({ timestamps: true, collection: 'schools' })
export class School {
  @Prop({ required: true, unique: true })
  name!: string;

  @Prop()
  region?: string;
}

export const SchoolSchema = SchemaFactory.createForClass(School);
