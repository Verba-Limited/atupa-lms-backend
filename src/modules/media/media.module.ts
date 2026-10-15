import { Logger, Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { resolve } from 'path';
import { AppConfig } from '../../config/app-config';
import { MediaService } from './application/media.service';
import { MEDIA_ASSET_REPOSITORY } from './application/ports/media-asset.repository.port';
import {
  MEDIA_STORAGE,
  MediaStorage,
} from './application/ports/media-storage.port';
import { MediaAssetMongoRepository } from './infrastructure/persistence/media-asset.mongo-repository';
import {
  MediaAssetRecord,
  MediaAssetSchema,
} from './infrastructure/persistence/media-asset.schema';
import { CloudinaryMediaStorage } from './infrastructure/storage/cloudinary.media-storage';
import { LocalDiskMediaStorage } from './infrastructure/storage/local-disk.media-storage';
import { MediaController } from './presentation/http/media.controller';

/** Cloudinary when configured, local disk otherwise (development). */
function createMediaStorage(config: AppConfig): MediaStorage {
  const { cloudName, apiKey, apiSecret, folder } = config.cloudinary;
  if (cloudName && apiKey && apiSecret) {
    return new CloudinaryMediaStorage({ cloudName, apiKey, apiSecret, folder });
  }
  if (config.isProduction) {
    new Logger('MediaModule').warn(
      'Cloudinary is not configured: falling back to local disk, which is wiped on redeploy.',
    );
  }
  return new LocalDiskMediaStorage(
    resolve(config.mediaUploadDir),
    config.apiBaseUrl,
  );
}

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: MediaAssetRecord.name, schema: MediaAssetSchema },
    ]),
  ],
  controllers: [MediaController],
  providers: [
    MediaService,
    { provide: MEDIA_ASSET_REPOSITORY, useClass: MediaAssetMongoRepository },
    {
      provide: MEDIA_STORAGE,
      inject: [AppConfig],
      useFactory: createMediaStorage,
    },
  ],
  exports: [MediaService],
})
export class MediaModule {}
