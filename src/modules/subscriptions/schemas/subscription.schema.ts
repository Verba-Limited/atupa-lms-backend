import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type UserSubscriptionDocument = HydratedDocument<UserSubscription>;

@Schema({ timestamps: true, collection: 'user_subscriptions' })
export class UserSubscription {
  @Prop({ required: true, unique: true, index: true })
  userId!: string;

  @Prop({ required: true, default: 'free' })
  planCode!: 'free' | 'individual_premium' | 'school';

  @Prop({ default: 'active' })
  status!: 'active' | 'pending' | 'cancelled';

  @Prop()
  paystackReference?: string;
}

export const UserSubscriptionSchema =
  SchemaFactory.createForClass(UserSubscription);
