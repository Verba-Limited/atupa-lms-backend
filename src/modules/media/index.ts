// Public API of the media module.
export { MediaModule } from './media.module';
export { MediaService } from './application/media.service';
export type { MediaAsset } from './domain/media-asset.entity';
export { MediaKind, MediaPurpose } from './domain/media-asset.entity';
export type { MediaPlayback, PlaybackSource } from './domain/media-playback';
export { externalPlayback } from './domain/media-playback';
