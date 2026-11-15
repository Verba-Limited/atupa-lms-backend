import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Schema as MongooseSchema } from 'mongoose';

@Schema({ timestamps: true, collection: 'plans' })
export class PlanRecord {
  @Prop({ required: true, unique: true, lowercase: true, trim: true })
  code!: string;

  @Prop({ required: true })
  label!: string;

  @Prop()
  description?: string;

  @Prop({ required: true, default: 1 })
  tier!: number;

  @Prop({ required: true, default: 0 })
  amountKobo!: number;

  @Prop({ required: true, default: 30 })
  periodDays!: number;

  @Prop({ required: true, enum: ['user', 'school'], type: String })
  ownerType!: string;

  @Prop({ type: [String], default: [] })
  features!: string[];

  @Prop({ default: true })
  isActive!: boolean;

  @Prop({ default: 0 })
  order!: number;
}
export const PlanSchema = SchemaFactory.createForClass(PlanRecord);

@Schema({ timestamps: true, collection: 'subscriptions' })
export class SubscriptionRecord {
  @Prop({ required: true, enum: ['user', 'school'], type: String })
  ownerType!: string;

  @Prop({ required: true })
  ownerId!: string;

  @Prop({ required: true })
  planCode!: string;

  @Prop({ required: true, default: 'active' })
  status!: string;

  @Prop()
  currentPeriodStart?: Date;

  @Prop({ index: true })
  currentPeriodEnd?: Date;

  @Prop({ type: MongooseSchema.Types.Mixed, default: null })
  lastManualChange?: Record<string, unknown> | null;
}
export const SubscriptionSchema =
  SchemaFactory.createForClass(SubscriptionRecord);
SubscriptionSchema.index({ ownerType: 1, ownerId: 1 }, { unique: true });

@Schema({ timestamps: true, collection: 'payments' })
export class PaymentRecord {
  @Prop({ required: true, unique: true })
  reference!: string;

  @Prop({ required: true })
  ownerType!: string;

  @Prop({ required: true, index: true })
  ownerId!: string;

  @Prop({ required: true })
  planCode!: string;

  @Prop({ required: true })
  amountKobo!: number;

  @Prop({ required: true, default: 'NGN' })
  currency!: string;

  @Prop({ required: true, default: 'pending', index: true })
  status!: string;

  @Prop({ required: true, index: true })
  initiatedByUserId!: string;

  @Prop()
  paidAt?: Date;

  @Prop()
  failureReason?: string;
}
export const PaymentSchema = SchemaFactory.createForClass(PaymentRecord);
