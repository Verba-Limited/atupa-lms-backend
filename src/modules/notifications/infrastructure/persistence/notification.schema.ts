import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { NotificationType } from '../../domain/notification.entity';

@Schema({ timestamps: true, collection: 'notifications' })
export class NotificationRecord {
  @Prop({ required: true }) userId!: string;
  @Prop({
    required: true,
    enum: NotificationType,
    type: String,
    default: NotificationType.ANNOUNCEMENT,
  })
  type!: NotificationType;
  @Prop({ required: true }) title!: string;
  @Prop({ required: true }) body!: string;
  @Prop({ type: Object }) data?: Record<string, string>;
  @Prop({ type: Date, default: null }) readAt?: Date | null;
}
export const NotificationSchema =
  SchemaFactory.createForClass(NotificationRecord);
NotificationSchema.index({ userId: 1, createdAt: -1 });
NotificationSchema.index({ userId: 1, readAt: 1 });
// Keep notifications for 180 days.
NotificationSchema.index(
  { createdAt: 1 },
  { expireAfterSeconds: 180 * 24 * 3600 },
);
