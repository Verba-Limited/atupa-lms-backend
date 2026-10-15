import { CrudPort } from '../../../../shared/application/crud.port';
import { Page, PageRequest } from '../../../../shared/domain/pagination';
import { MediaAsset, MediaKind } from '../../domain/media-asset.entity';

export const MEDIA_ASSET_REPOSITORY = Symbol('MEDIA_ASSET_REPOSITORY');

export interface MediaAssetRepository extends CrudPort<MediaAsset> {
  findByPublicId(publicId: string): Promise<MediaAsset | null>;
  list(
    filter: { ownerUserId?: string; kind?: MediaKind },
    page: PageRequest,
  ): Promise<Page<MediaAsset>>;
}
