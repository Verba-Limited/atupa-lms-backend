import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { MediaKind, MediaPurpose } from '../../domain/media-asset.entity';

@Schema({ timestamps: true, collection: 'media_assets' })
export class MediaAssetRecord {
  @Prop({ required: true })
  provider!: string;

  @Prop({ required: true, unique: true })
  publicId!: string;

  @Prop({ required: true, enum: MediaKind, type: String, index: true })
  kind!: MediaKind;

  @Prop({ required: true, enum: MediaPurpose, type: String })
  purpose!: MediaPurpose;

  @Prop()
  format?: string;

  @Prop({ required: true })
  bytes!: number;

  @Prop()
  width?: number;

  @Prop()
  height?: number;

  @Prop()
  durationSeconds?: number;

  @Prop({ required: true })
  url!: string;

  @Prop({ required: true })
  optimizedUrl!: string;

  @Prop()
  streamingUrl?: string;

  @Prop()
  thumbnailUrl?: string;

  @Prop({ required: true, index: true })
  ownerUserId!: string;

  @Prop()
  originalName?: string;
}

export const MediaAssetSchema = SchemaFactory.createForClass(MediaAssetRecord);
