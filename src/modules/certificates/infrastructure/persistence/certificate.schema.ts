import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

@Schema({ timestamps: true, collection: 'certificates' })
export class CertificateRecord {
  @Prop({ required: true, unique: true }) certificateId!: string;
  @Prop({ required: true, unique: true }) verificationCode!: string;
  @Prop({ required: true, index: true }) userId!: string;
  @Prop({ required: true }) learnerName!: string;
  @Prop({ required: true, index: true }) courseId!: string;
  @Prop({ required: true }) courseTitle!: string;
  @Prop({ required: true }) languageCode!: string;
  @Prop() languageName?: string;
  @Prop() level?: string;
  @Prop({ required: true }) completedAt!: Date;
  @Prop({ required: true, default: 'valid' }) status!: string;
  @Prop() revokedReason?: string;
}
export const CertificateSchema =
  SchemaFactory.createForClass(CertificateRecord);
CertificateSchema.index(
  { userId: 1, courseId: 1 },
  { unique: true, partialFilterExpression: { status: 'valid' } },
);
