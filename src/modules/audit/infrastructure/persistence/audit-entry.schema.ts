import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Schema as MongooseSchema } from 'mongoose';

@Schema({
  timestamps: { createdAt: true, updatedAt: false },
  collection: 'activity_log',
})
export class AuditEntryRecord {
  @Prop({ required: true, index: true }) actorId!: string;
  @Prop({ required: true }) actorEmail!: string;
  @Prop({ required: true, index: true }) actorRole!: string;
  @Prop({ required: true, index: true }) action!: string;
  @Prop({ required: true }) method!: string;
  @Prop({ required: true }) path!: string;
  @Prop({ type: String, default: null, index: true }) targetId?: string | null;
  @Prop({ type: MongooseSchema.Types.Mixed, default: null })
  details?: Record<string, unknown> | null;
  @Prop({ required: true }) statusCode!: number;
  @Prop({ type: String, default: null }) ip?: string | null;
}
export const AuditEntrySchema = SchemaFactory.createForClass(AuditEntryRecord);
AuditEntrySchema.index({ createdAt: -1 });
