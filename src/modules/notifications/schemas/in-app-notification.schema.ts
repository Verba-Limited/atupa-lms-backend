import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type InAppNotificationDocument = HydratedDocument<InAppNotification>;

@Schema({ timestamps: true, collection: 'notifications' })
export class InAppNotification {
  @Prop({ required: true, index: true })
  userId!: string;

  @Prop({ required: true })
  title!: string;

  @Prop({ required: true })
  body!: string;

  @Prop({ default: false })
  read!: boolean;
}

export const InAppNotificationSchema =
  SchemaFactory.createForClass(InAppNotification);
