import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type MediaAssetDocument = HydratedDocument<MediaAsset>;

@Schema({ timestamps: true, collection: 'media_assets' })
export class MediaAsset {
  @Prop({ required: true })
  filename!: string;

  @Prop({ required: true })
  mimeType!: string;

  @Prop({ required: true })
  url!: string;

  @Prop({ required: true })
  uploadedByUserId!: string;
}

export const MediaAssetSchema = SchemaFactory.createForClass(MediaAsset);
