import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { mkdir, unlink, writeFile } from 'fs/promises';
import { extname, join, normalize } from 'path';
import { ValidationError } from '../../../../shared/domain/errors';
import {
  DirectUploadTicket,
  MediaStorage,
  StoredMedia,
} from '../../application/ports/media-storage.port';
import { MediaKind } from '../../domain/media-asset.entity';

/**
 * Development fallback when Cloudinary is not configured. Files are written
 * under MEDIA_UPLOAD_DIR and served at /uploads. Not for production: Render
 * disks are wiped on every deploy.
 */
@Injectable()
export class LocalDiskMediaStorage implements MediaStorage {
  readonly provider = 'local' as const;
  readonly baseFolder = 'media';
  private readonly logger = new Logger(LocalDiskMediaStorage.name);

  constructor(
    private readonly rootDir: string,
    private readonly publicBaseUrl: string,
  ) {}

  createDirectUpload(): Promise<DirectUploadTicket> {
    return Promise.resolve({
      mode: 'server',
      uploadUrl: `${this.publicBaseUrl}/api/v1/media/upload`,
      fields: {},
    });
  }

  describe(): Promise<StoredMedia | null> {
    return Promise.resolve(null);
  }

  async upload(
    file: { buffer: Buffer; originalName: string; mimeType: string },
    _kind: MediaKind,
    folder: string,
  ): Promise<StoredMedia> {
    const format = extname(file.originalName).replace('.', '').toLowerCase();
    if (!/^[a-z0-9]{1,5}$/.test(format)) {
      throw new ValidationError('File must have a valid extension');
    }
    const publicId = `${folder}/${randomUUID()}`;
    const relative = `${publicId}.${format}`;
    const target = normalize(join(this.rootDir, relative));
    await mkdir(join(this.rootDir, folder), { recursive: true });
    await writeFile(target, file.buffer);
    const url = `${this.publicBaseUrl}/uploads/${relative}`;
    return {
      publicId: relative,
      format,
      bytes: file.buffer.length,
      url,
      optimizedUrl: url,
    };
  }

  async remove(publicId: string): Promise<void> {
    try {
      await unlink(normalize(join(this.rootDir, publicId)));
    } catch (error) {
      this.logger.warn(
        `Could not delete ${publicId}: ${(error as Error).message}`,
      );
    }
  }
}
