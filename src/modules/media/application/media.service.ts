import { Inject, Injectable } from '@nestjs/common';
import type { Actor } from '../../../shared/application/actor';
import {
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from '../../../shared/domain/errors';
import { Page, PageRequest } from '../../../shared/domain/pagination';
import {
  CONTENT_AUTHOR_ROLES,
  PLATFORM_CONTENT_ROLES,
  UserRole,
} from '../../../shared/domain/user-role';
import {
  assertAllowedFile,
  kindFromMime,
  MAX_SERVER_UPLOAD_BYTES,
  MediaAsset,
  MediaKind,
  MediaPurpose,
} from '../domain/media-asset.entity';
import type { MediaAssetRepository } from './ports/media-asset.repository.port';
import { MEDIA_ASSET_REPOSITORY } from './ports/media-asset.repository.port';
import type {
  DirectUploadTicket,
  MediaStorage,
  StoredMedia,
} from './ports/media-storage.port';
import { MEDIA_STORAGE } from './ports/media-storage.port';

@Injectable()
export class MediaService {
  constructor(
    @Inject(MEDIA_STORAGE) private readonly storage: MediaStorage,
    @Inject(MEDIA_ASSET_REPOSITORY)
    private readonly assets: MediaAssetRepository,
  ) {}

  /** Step 1 of a direct upload: signed parameters for the client. */
  requestUpload(
    actor: Actor,
    kind: MediaKind,
    purpose: MediaPurpose,
  ): Promise<DirectUploadTicket> {
    assertPurposeAllowed(actor, kind, purpose);
    return this.storage.createDirectUpload(
      kind,
      this.folderFor(actor, kind, purpose),
    );
  }

  /** Step 2 of a direct upload: verify the stored file and register it. */
  async confirmUpload(
    actor: Actor,
    input: {
      publicId: string;
      kind: MediaKind;
      purpose: MediaPurpose;
      originalName?: string;
    },
  ): Promise<MediaAsset> {
    assertPurposeAllowed(actor, input.kind, input.purpose);
    const folder = this.folderFor(actor, input.kind, input.purpose);
    if (!input.publicId.startsWith(`${folder}/`)) {
      throw new ForbiddenError(
        'This file was not uploaded with your upload ticket',
      );
    }
    const existing = await this.assets.findByPublicId(input.publicId);
    if (existing) return existing;

    const stored = await this.storage.describe(input.publicId, input.kind);
    if (!stored) throw new NotFoundError('Uploaded file not found');
    try {
      assertAllowedFile(input.kind, stored.format ?? '', stored.bytes);
    } catch (error) {
      await this.storage.remove(stored.publicId, input.kind);
      throw error;
    }
    return this.register(
      actor,
      stored,
      input.kind,
      input.purpose,
      input.originalName,
    );
  }

  /** Upload through the API (small files, or when direct upload is unavailable). */
  async uploadViaServer(
    actor: Actor,
    file: {
      buffer: Buffer;
      originalname: string;
      mimetype: string;
      size: number;
    },
    purpose: MediaPurpose,
  ): Promise<MediaAsset> {
    const kind = kindFromMime(file.mimetype);
    assertPurposeAllowed(actor, kind, purpose);
    if (file.size > MAX_SERVER_UPLOAD_BYTES) {
      throw new ValidationError('Files over 25MB must use direct upload');
    }
    const format = file.originalname.split('.').pop() ?? '';
    assertAllowedFile(kind, format, file.size);
    const stored = await this.storage.upload(
      {
        buffer: file.buffer,
        originalName: file.originalname,
        mimeType: file.mimetype,
      },
      kind,
      this.folderFor(actor, kind, purpose),
    );
    return this.register(actor, stored, kind, purpose, file.originalname);
  }

  list(
    actor: Actor,
    filter: { kind?: MediaKind; all?: boolean },
    page: PageRequest,
  ): Promise<Page<MediaAsset>> {
    const seeAll = filter.all && PLATFORM_CONTENT_ROLES.includes(actor.role);
    return this.assets.list(
      { kind: filter.kind, ownerUserId: seeAll ? undefined : actor.userId },
      page,
    );
  }

  async get(actor: Actor, id: string): Promise<MediaAsset> {
    const asset = await this.assets.findById(id);
    if (!asset) throw new NotFoundError('Media not found');
    if (
      asset.ownerUserId !== actor.userId &&
      !PLATFORM_CONTENT_ROLES.includes(actor.role)
    ) {
      throw new ForbiddenError('You cannot view this media record');
    }
    return asset;
  }

  async remove(actor: Actor, id: string): Promise<void> {
    const asset = await this.assets.findById(id);
    if (!asset) throw new NotFoundError('Media not found');
    if (
      asset.ownerUserId !== actor.userId &&
      actor.role !== UserRole.SUPER_ADMIN
    ) {
      throw new ForbiddenError(
        'Only the uploader or a super admin can delete this file',
      );
    }
    await this.storage.remove(asset.publicId, asset.kind);
    await this.assets.delete(id);
  }

  private folderFor(
    actor: Actor,
    kind: MediaKind,
    purpose: MediaPurpose,
  ): string {
    return `${this.storage.baseFolder}/${purpose}/${kind}/${actor.userId}`;
  }

  private register(
    actor: Actor,
    stored: StoredMedia,
    kind: MediaKind,
    purpose: MediaPurpose,
    originalName?: string,
  ): Promise<MediaAsset> {
    return this.assets.create({
      ...stored,
      provider: this.storage.provider,
      kind,
      purpose,
      ownerUserId: actor.userId,
      originalName,
    });
  }
}

/**
 * - content: authors only (any kind)
 * - profile: anyone, images only
 * - submission: learners (assignment work), images and audio only
 */
export function assertPurposeAllowed(
  actor: Actor,
  kind: MediaKind,
  purpose: MediaPurpose,
): void {
  if (
    purpose === MediaPurpose.CONTENT &&
    !CONTENT_AUTHOR_ROLES.includes(actor.role)
  ) {
    throw new ForbiddenError(
      'Only content authors can upload learning content',
    );
  }
  if (purpose === MediaPurpose.PROFILE && kind !== MediaKind.IMAGE) {
    throw new ValidationError('Profile uploads must be images');
  }
  if (purpose === MediaPurpose.SUBMISSION) {
    if (actor.role !== UserRole.LEARNER) {
      throw new ForbiddenError('Only learners upload assignment submissions');
    }
    if (kind === MediaKind.VIDEO) {
      throw new ValidationError(
        'Submissions can be images or audio recordings',
      );
    }
  }
}
