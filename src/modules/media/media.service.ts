import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { MediaAsset, MediaAssetDocument } from './schemas/media-asset.schema';

@Injectable()
export class MediaService {
  constructor(
    @InjectModel(MediaAsset.name)
    private readonly mediaModel: Model<MediaAsset>,
  ) {}

  registerUpload(input: {
    filename: string;
    mimeType: string;
    url: string;
    uploadedByUserId: string;
  }) {
    return this.mediaModel.create(input);
  }

  list(limit = 50): Promise<MediaAssetDocument[]> {
    return this.mediaModel.find().sort({ createdAt: -1 }).limit(limit).exec();
  }
}
