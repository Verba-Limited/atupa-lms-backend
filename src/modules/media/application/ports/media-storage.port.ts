import { MediaKind } from '../../domain/media-asset.entity';

export const MEDIA_STORAGE = Symbol('MEDIA_STORAGE');

export interface StoredMedia {
  publicId: string;
  format?: string;
  bytes: number;
  width?: number;
  height?: number;
  durationSeconds?: number;
  url: string;
  optimizedUrl: string;
  streamingUrl?: string;
  thumbnailUrl?: string;
}

/** Signed parameters the client posts directly to the storage provider. */
export interface DirectUploadTicket {
  mode: 'direct' | 'server';
  uploadUrl: string;
  /** Form fields to send with the file (direct mode). */
  fields: Record<string, string | number>;
  /** Where the uploaded file must live; checked again on confirm. */
  folder?: string;
  expiresAt?: Date;
}

/** Outbound port to an object storage / media CDN provider. */
export interface MediaStorage {
  readonly provider: 'cloudinary' | 'local';
  /** Root folder all of this app's files live under. */
  readonly baseFolder: string;
  createDirectUpload(
    kind: MediaKind,
    folder: string,
  ): Promise<DirectUploadTicket>;
  /** Looks up a directly-uploaded file; null if it does not exist. */
  describe(publicId: string, kind: MediaKind): Promise<StoredMedia | null>;
  upload(
    file: { buffer: Buffer; originalName: string; mimeType: string },
    kind: MediaKind,
    folder: string,
  ): Promise<StoredMedia>;
  remove(publicId: string, kind: MediaKind): Promise<void>;
}
