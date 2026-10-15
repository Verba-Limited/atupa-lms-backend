import { Injectable } from '@nestjs/common';
import { v2 as cloudinary, UploadApiResponse } from 'cloudinary';
import { ServiceUnavailableError } from '../../../../shared/domain/errors';
import {
  DirectUploadTicket,
  MediaStorage,
  StoredMedia,
} from '../../application/ports/media-storage.port';
import { ALLOWED_FORMATS, MediaKind } from '../../domain/media-asset.entity';

interface CloudinaryResource {
  public_id: string;
  format?: string;
  bytes: number;
  width?: number;
  height?: number;
  duration?: number;
  secure_url: string;
}

const UPLOAD_TICKET_TTL_SECONDS = 3600;

/** Cloudinary stores audio and video under the "video" resource type. */
function resourceType(kind: MediaKind): 'image' | 'video' {
  return kind === MediaKind.IMAGE ? 'image' : 'video';
}

/**
 * Cloudinary adapter. Learners on mobile data get compressed derivatives:
 * f_auto/q_auto images, adaptive HLS video and 64kbps MP3 audio.
 */
@Injectable()
export class CloudinaryMediaStorage implements MediaStorage {
  readonly provider = 'cloudinary' as const;

  get baseFolder(): string {
    return this.settings.folder;
  }

  constructor(
    private readonly settings: {
      cloudName: string;
      apiKey: string;
      apiSecret: string;
      folder: string;
    },
  ) {
    cloudinary.config({
      cloud_name: settings.cloudName,
      api_key: settings.apiKey,
      api_secret: settings.apiSecret,
      secure: true,
    });
  }

  createDirectUpload(
    kind: MediaKind,
    folder: string,
  ): Promise<DirectUploadTicket> {
    const timestamp = Math.round(Date.now() / 1000);
    const paramsToSign = {
      timestamp,
      folder,
      allowed_formats: ALLOWED_FORMATS[kind].join(','),
    };
    const signature = cloudinary.utils.api_sign_request(
      paramsToSign,
      this.settings.apiSecret,
    );
    return Promise.resolve({
      mode: 'direct',
      uploadUrl: `https://api.cloudinary.com/v1_1/${this.settings.cloudName}/${resourceType(kind)}/upload`,
      fields: { ...paramsToSign, signature, api_key: this.settings.apiKey },
      folder,
      expiresAt: new Date((timestamp + UPLOAD_TICKET_TTL_SECONDS) * 1000),
    });
  }

  async describe(
    publicId: string,
    kind: MediaKind,
  ): Promise<StoredMedia | null> {
    try {
      const resource = (await cloudinary.api.resource(publicId, {
        resource_type: resourceType(kind),
      })) as CloudinaryResource;
      return this.toStoredMedia(resource, kind);
    } catch (error) {
      const status = (error as { error?: { http_code?: number } }).error
        ?.http_code;
      if (status === 404) return null;
      throw new ServiceUnavailableError('Media storage is unavailable');
    }
  }

  upload(
    file: { buffer: Buffer; originalName: string; mimeType: string },
    kind: MediaKind,
    folder: string,
  ): Promise<StoredMedia> {
    return new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          folder,
          resource_type: resourceType(kind),
          allowed_formats: ALLOWED_FORMATS[kind],
        },
        (error, result?: UploadApiResponse) => {
          if (error || !result) {
            reject(
              new ServiceUnavailableError(error?.message ?? 'Upload failed'),
            );
            return;
          }
          resolve(this.toStoredMedia(result, kind));
        },
      );
      stream.end(file.buffer);
    });
  }

  async remove(publicId: string, kind: MediaKind): Promise<void> {
    await cloudinary.uploader.destroy(publicId, {
      resource_type: resourceType(kind),
      invalidate: true,
    });
  }

  private toStoredMedia(
    resource: CloudinaryResource,
    kind: MediaKind,
  ): StoredMedia {
    const id = resource.public_id;
    const base: StoredMedia = {
      publicId: id,
      format: resource.format,
      bytes: resource.bytes,
      width: resource.width,
      height: resource.height,
      durationSeconds: resource.duration,
      url: resource.secure_url,
      optimizedUrl: resource.secure_url,
    };
    if (kind === MediaKind.IMAGE) {
      base.optimizedUrl = cloudinary.url(id, {
        transformation: [
          { width: 1280, crop: 'limit', fetch_format: 'auto', quality: 'auto' },
        ],
      });
      base.thumbnailUrl = cloudinary.url(id, {
        transformation: [
          { width: 320, crop: 'limit', fetch_format: 'auto', quality: 'auto' },
        ],
      });
    } else if (kind === MediaKind.AUDIO) {
      base.optimizedUrl = cloudinary.url(id, {
        resource_type: 'video',
        format: 'mp3',
        transformation: [{ audio_codec: 'mp3', bit_rate: '64k' }],
      });
    } else {
      base.optimizedUrl = cloudinary.url(id, {
        resource_type: 'video',
        format: 'mp4',
        transformation: [{ width: 854, crop: 'limit', quality: 'auto' }],
      });
      base.streamingUrl = cloudinary.url(id, {
        resource_type: 'video',
        format: 'm3u8',
        transformation: [{ streaming_profile: 'auto' }],
      });
      base.thumbnailUrl = cloudinary.url(id, {
        resource_type: 'video',
        format: 'jpg',
        transformation: [
          { width: 640, crop: 'limit', quality: 'auto', start_offset: '1' },
        ],
      });
    }
    return base;
  }
}
