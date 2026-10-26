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
import {
  externalPlayback,
  guessKind,
  MediaPlayback,
  toPlayback,
} from '../domain/media-playback';
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
      /** `duration` from the provider's upload response, used if the server can't read it. */
      durationSeconds?: number;
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
    if (
      stored.durationSeconds === undefined &&
      input.durationSeconds !== undefined
    ) {
      stored.durationSeconds = input.durationSeconds;
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

  // ---- Playback (learner-facing) ---------------------------------------------

  /**
   * Playback details for one asset. Content and profile media are visible to
   * any signed-in user (they appear in lessons); learner submissions only to
   * their owner and to staff such as teachers.
   */
  async getPlayback(actor: Actor, id: string): Promise<MediaPlayback> {
    const asset = await this.assets.findById(id);
    if (!asset) throw new NotFoundError('Media not found');
    if (
      asset.purpose === MediaPurpose.SUBMISSION &&
      asset.ownerUserId !== actor.userId &&
      (actor.role === UserRole.LEARNER || actor.role === UserRole.PARENT)
    ) {
      throw new ForbiddenError('You cannot view this submission');
    }
    return toPlayback(asset);
  }

  /**
   * Resolves media URLs (as stored on lessons, vocabulary, quizzes...) to
   * playback details. URLs that are not uploaded assets get a basic entry
   * built from the URL itself, so clients can treat every item the same way.
   */
  async resolveUrls(
    urls: Array<string | undefined | null>,
    kindHint?: MediaKind,
  ): Promise<Map<string, MediaPlayback>> {
    const unique = [...new Set(urls.filter((u): u is string => !!u))];
    const result = new Map<string, MediaPlayback>();
    if (!unique.length) return result;
    const assets = await this.assets.findByUrls(unique);
    for (const asset of assets) {
      if (asset.purpose === MediaPurpose.SUBMISSION) continue;
      const playback = toPlayback(asset);
      for (const u of [asset.url, asset.optimizedUrl]) {
        if (unique.includes(u)) result.set(u, playback);
      }
    }
    for (const u of unique) {
      if (result.has(u)) continue;
      const kind = kindHint ?? guessKind(u);
      if (kind) result.set(u, externalPlayback(u, kind));
    }
    return result;
  }

  async resolveUrl(
    url: string | undefined | null,
    kindHint?: MediaKind,
  ): Promise<MediaPlayback | null> {
    if (!url) return null;
    return (await this.resolveUrls([url], kindHint)).get(url) ?? null;
  }

  /**
   * Checks assets attached to lesson content: they must exist, be content
   * uploads and match the expected kind. Returns them keyed by id.
   */
  async requireContentAssets(
    refs: Array<{ id: string; kind?: MediaKind }>,
  ): Promise<Map<string, MediaAsset>> {
    const assets = await this.assets.findByIds(refs.map((r) => r.id));
    const byId = new Map(assets.map((a) => [a.id, a]));
    for (const ref of refs) {
      const asset = byId.get(ref.id);
      if (!asset || asset.purpose !== MediaPurpose.CONTENT) {
        throw new ValidationError(
          `Media ${ref.id} was not found in the content library`,
        );
      }
      if (ref.kind && asset.kind !== ref.kind) {
        throw new ValidationError(
          `Media ${ref.id} is ${asset.kind}, expected ${ref.kind}`,
        );
      }
    }
    return byId;
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
