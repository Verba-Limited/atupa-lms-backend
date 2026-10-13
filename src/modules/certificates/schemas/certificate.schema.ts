import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type CertificateDocument = HydratedDocument<Certificate>;

@Schema({ timestamps: true, collection: 'certificates' })
export class Certificate {
  @Prop({ required: true, unique: true, index: true })
  certificateId!: string;

  @Prop({ required: true, unique: true, index: true })
  verificationCode!: string;

  @Prop({ required: true, index: true })
  userId!: string;

  @Prop({ required: true })
  learnerName!: string;

  @Prop({ required: true })
  courseId!: string;

  @Prop({ required: true })
  courseTitle!: string;

  @Prop({ required: true })
  languageCode!: string;

  @Prop({ required: true })
  completedAt!: Date;
}

export const CertificateSchema = SchemaFactory.createForClass(Certificate);
