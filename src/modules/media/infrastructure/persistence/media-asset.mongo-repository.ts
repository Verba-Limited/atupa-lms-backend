import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { PageRequest } from '../../../../shared/domain/pagination';
import { MongoCrudRepository } from '../../../../shared/infrastructure/mongo/mongo-crud.repository';
import { MediaAssetRepository } from '../../application/ports/media-asset.repository.port';
import { MediaAsset, MediaKind } from '../../domain/media-asset.entity';
import { MediaAssetRecord } from './media-asset.schema';

@Injectable()
export class MediaAssetMongoRepository
  extends MongoCrudRepository<MediaAsset>
  implements MediaAssetRepository
{
  constructor(
    @InjectModel(MediaAssetRecord.name) model: Model<MediaAssetRecord>,
  ) {
    super(model);
  }

  findByPublicId(publicId: string) {
    return this.findOneBy({ publicId });
  }

  list(filter: { ownerUserId?: string; kind?: MediaKind }, page: PageRequest) {
    const query: Record<string, unknown> = {};
    if (filter.ownerUserId) query.ownerUserId = filter.ownerUserId;
    if (filter.kind) query.kind = filter.kind;
    return this.paginateBy(query, page);
  }
}
