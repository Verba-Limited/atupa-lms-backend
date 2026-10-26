import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { from, Observable, switchMap } from 'rxjs';
import { MediaService } from '../../application/media.service';
import { MediaKind } from '../../domain/media-asset.entity';
import { MediaPlayback } from '../../domain/media-playback';

/**
 * Media URL fields and the playback field added next to them.
 * `mediaUrls` (string[]) becomes `media` (playback[]).
 */
const FIELDS: Record<string, { target: string; kind?: MediaKind }> = {
  mediaUrl: { target: 'media' },
  audioUrl: { target: 'audio', kind: MediaKind.AUDIO },
  imageUrl: { target: 'image', kind: MediaKind.IMAGE },
  coverImageUrl: { target: 'coverImage', kind: MediaKind.IMAGE },
  profileImageUrl: { target: 'profileImage', kind: MediaKind.IMAGE },
  mediaUrls: { target: 'media' },
};

const MAX_DEPTH = 10;
const MAX_URLS = 300;

type Plain = Record<string, unknown>;

function isPlain(value: unknown): value is Plain {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const proto = Object.getPrototypeOf(value) as unknown;
  return proto === Object.prototype || proto === null;
}

interface Collected {
  urls: Map<string, MediaKind | undefined>;
  /** Media fields still needing playback (including empty ones). */
  fields: number;
}

function collect(value: unknown, acc: Collected, depth = 0) {
  if (depth > MAX_DEPTH || acc.urls.size >= MAX_URLS) return;
  if (Array.isArray(value)) {
    value.forEach((v) => collect(v, acc, depth + 1));
    return;
  }
  if (!isPlain(value)) return;
  for (const [key, v] of Object.entries(value)) {
    const field = FIELDS[key];
    if (!field) {
      collect(v, acc, depth + 1);
      continue;
    }
    if (field.target in value) continue;
    acc.fields++;
    const list = Array.isArray(v) ? v : [v];
    list.forEach(
      (u) => typeof u === 'string' && u && acc.urls.set(u, field.kind),
    );
  }
}

function annotate(
  value: unknown,
  playback: Map<string, MediaPlayback>,
  depth = 0,
): unknown {
  if (depth > MAX_DEPTH) return value;
  if (Array.isArray(value))
    return value.map((v) => annotate(v, playback, depth + 1));
  if (!isPlain(value)) return value;
  const out: Plain = {};
  for (const [key, v] of Object.entries(value)) {
    out[key] = FIELDS[key] ? v : annotate(v, playback, depth + 1);
  }
  for (const [key, field] of Object.entries(FIELDS)) {
    if (!(key in value) || field.target in value) continue;
    const v = value[key];
    if (typeof v === 'string')
      out[field.target] = (v && playback.get(v)) || null;
    else if (Array.isArray(v)) {
      out[field.target] = v
        .map((u) => (typeof u === 'string' ? playback.get(u) : undefined))
        .filter((p): p is MediaPlayback => !!p);
    }
  }
  return out;
}

/**
 * Adds playback details (sources, poster, duration...) next to every media
 * URL in API responses, for learners and staff alike: `mediaUrl` → `media`,
 * `audioUrl` → `audio`, `imageUrl` → `image`, `coverImageUrl` → `coverImage`,
 * `profileImageUrl` → `profileImage`, `mediaUrls` → `media[]`.
 * Fields a use case already filled are left untouched.
 */
@Injectable()
export class MediaPlaybackInterceptor implements NestInterceptor {
  constructor(private readonly media: MediaService) {}

  intercept(
    _context: ExecutionContext,
    next: CallHandler,
  ): Observable<unknown> {
    return next.handle().pipe(switchMap((body) => from(this.enrich(body))));
  }

  async enrich(body: unknown): Promise<unknown> {
    const acc: Collected = { urls: new Map(), fields: 0 };
    collect(body, acc);
    if (!acc.fields) return body;
    const playback = new Map<string, MediaPlayback>();
    const byKind = new Map<MediaKind | undefined, string[]>();
    for (const [url, kind] of acc.urls)
      byKind.set(kind, [...(byKind.get(kind) ?? []), url]);
    for (const [kind, list] of byKind) {
      for (const [url, p] of await this.media.resolveUrls(list, kind, {
        // A submission URL only appears in responses whose use case already
        // checked the viewer may see it (owner, their teacher...).
        includeSubmissions: true,
      }))
        playback.set(url, p);
    }
    return annotate(body, playback);
  }
}
