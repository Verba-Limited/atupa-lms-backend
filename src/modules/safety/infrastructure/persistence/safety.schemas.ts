import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Schema as MongooseSchema } from 'mongoose';

@Schema({ timestamps: true, collection: 'safety_reports' })
export class SafetyReportRecord {
  @Prop({ required: true, unique: true }) reference!: string;
  @Prop({ required: true, index: true }) reporterId!: string;
  @Prop({ required: true }) reporterRole!: string;
  @Prop({ required: true }) targetType!: string;
  @Prop({ required: true, index: true }) targetId!: string;
  @Prop({ required: true }) targetName!: string;
  @Prop({ type: String, default: null, index: true })
  targetOwnerId?: string | null;
  @Prop({ type: String, default: null }) targetSchoolId?: string | null;
  @Prop({ required: true }) reason!: string;
  @Prop({ type: String, default: null }) note?: string | null;
  @Prop({ type: [{ mediaId: String, url: String, _id: false }], default: [] })
  attachments!: Array<{ mediaId: string; url: string }>;
  @Prop({ required: true, index: true }) severity!: string;
  /** 3 critical, 2 high, 1 normal: lets the queue sort by seriousness. */
  @Prop({ required: true, index: true }) severityRank!: number;
  @Prop({ required: true, default: 'open', index: true }) status!: string;
  @Prop({ type: String, default: null, index: true })
  assigneeId?: string | null;
  @Prop({
    type: [{ authorId: String, body: String, at: Date, _id: false }],
    default: [],
  })
  comments!: Array<{ authorId: string; body: string; at: Date }>;
  @Prop({ type: String, default: null }) outcome?: string | null;
  @Prop({ type: String, default: null }) outcomeNote?: string | null;
  @Prop({ required: true }) dueAt!: Date;
  @Prop({ type: Date, default: null }) resolvedAt?: Date | null;
  @Prop({ type: String, default: null }) resolvedByUserId?: string | null;
}
export const SafetyReportSchema =
  SchemaFactory.createForClass(SafetyReportRecord);
SafetyReportSchema.index({ status: 1, severityRank: -1, createdAt: 1 });

@Schema({ timestamps: true, collection: 'safety_alerts' })
export class AlertRecord {
  @Prop({ required: true, index: true }) type!: string;
  @Prop({ required: true }) severity!: string;
  @Prop({ required: true }) subjectType!: string;
  @Prop({ required: true, index: true }) subjectId!: string;
  @Prop({ required: true }) summary!: string;
  @Prop({ type: MongooseSchema.Types.Mixed, default: null })
  details?: Record<string, unknown> | null;
  @Prop({ required: true, default: 'open', index: true }) status!: string;
  @Prop({ required: true }) dedupeKey!: string;
  @Prop({ required: true, default: 1 }) occurrences!: number;
  @Prop({ required: true }) lastSeenAt!: Date;
  @Prop({ type: String, default: null }) note?: string | null;
  @Prop({ type: String, default: null }) handledByUserId?: string | null;
}
export const AlertSchema = SchemaFactory.createForClass(AlertRecord);
// At most one open alert per key.
AlertSchema.index(
  { dedupeKey: 1 },
  { unique: true, partialFilterExpression: { status: 'open' } },
);

@Schema({ collection: 'safety_signals' })
export class SignalRecord {
  @Prop({ required: true }) kind!: string;
  @Prop({ required: true }) key!: string;
  @Prop({ required: true }) userId!: string;
  @Prop({ required: true, default: () => new Date() }) at!: Date;
}
export const SignalSchema = SchemaFactory.createForClass(SignalRecord);
SignalSchema.index({ kind: 1, key: 1, at: -1 });
SignalSchema.index({ at: 1 }, { expireAfterSeconds: 3 * 24 * 3600 });
