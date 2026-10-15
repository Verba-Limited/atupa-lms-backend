import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

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
