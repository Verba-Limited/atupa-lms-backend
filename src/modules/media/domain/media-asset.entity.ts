import { ValidationError } from '../../../shared/domain/errors';

export enum MediaKind {
  IMAGE = 'image',
  AUDIO = 'audio',
  VIDEO = 'video',
}

/** Why a file is uploaded; drives who may upload it and how big it may be. */
export enum MediaPurpose {
  CONTENT = 'content',
  PROFILE = 'profile',
  SUBMISSION = 'submission',
}

export interface MediaAsset {
  id: string;
  provider: 'cloudinary' | 'local';
  publicId: string;
  kind: MediaKind;
  purpose: MediaPurpose;
  format?: string;
  bytes: number;
  width?: number;
  height?: number;
  durationSeconds?: number;
  /** Original file URL. */
  url: string;
  /** Compressed, device-friendly URL (f_auto/q_auto, 64k audio...). */
  optimizedUrl: string;
  /** Adaptive (HLS) stream for video. */
  streamingUrl?: string;
  thumbnailUrl?: string;
  ownerUserId: string;
  originalName?: string;
  createdAt?: Date;
}

export const ALLOWED_FORMATS: Record<MediaKind, string[]> = {
  [MediaKind.IMAGE]: ['jpg', 'jpeg', 'png', 'webp', 'gif', 'avif'],
  [MediaKind.AUDIO]: ['mp3', 'm4a', 'aac', 'wav', 'ogg', 'oga', 'webm'],
  [MediaKind.VIDEO]: ['mp4', 'mov', 'webm', 'm4v'],
};

const MB = 1024 * 1024;

export const MAX_BYTES: Record<MediaKind, number> = {
  [MediaKind.IMAGE]: 10 * MB,
  [MediaKind.AUDIO]: 20 * MB,
  [MediaKind.VIDEO]: 300 * MB,
};

/** Files sent through our own API (not direct-to-cloud) are capped lower. */
export const MAX_SERVER_UPLOAD_BYTES = 25 * MB;

export function kindFromMime(mimeType: string): MediaKind {
  if (mimeType.startsWith('image/')) return MediaKind.IMAGE;
  if (mimeType.startsWith('audio/')) return MediaKind.AUDIO;
  if (mimeType.startsWith('video/')) return MediaKind.VIDEO;
  throw new ValidationError(`Unsupported file type: ${mimeType}`);
}

export function assertAllowedFile(
  kind: MediaKind,
  format: string,
  bytes: number,
) {
  if (!ALLOWED_FORMATS[kind].includes(format.toLowerCase())) {
    throw new ValidationError(
      `.${format} is not allowed for ${kind}. Allowed: ${ALLOWED_FORMATS[kind].join(', ')}`,
    );
  }
  if (bytes > MAX_BYTES[kind]) {
    throw new ValidationError(
      `${kind} files must be under ${Math.round(MAX_BYTES[kind] / MB)}MB`,
    );
  }
}
