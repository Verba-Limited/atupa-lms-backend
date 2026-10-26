import { MediaAsset, MediaKind } from './media-asset.entity';

export interface PlaybackSource {
  src: string;
  /** MIME type for <source type="...">. */
  type: string;
}

/**
 * Everything a client needs to show or play a media file. `sources` is
 * ordered best-first: adaptive HLS, then compressed MP4/MP3, then original.
 */
export interface MediaPlayback {
  /** Media asset id, or null for an external URL that was not uploaded here. */
  id: string | null;
  kind: MediaKind;
  format?: string;
  durationSeconds?: number;
  width?: number;
  height?: number;
  bytes?: number;
  url: string;
  optimizedUrl: string;
  streamingUrl?: string;
  thumbnailUrl?: string;
  sources: PlaybackSource[];
}

const MIME: Record<string, string> = {
  mp3: 'audio/mpeg',
  m4a: 'audio/mp4',
  aac: 'audio/aac',
  wav: 'audio/wav',
  ogg: 'audio/ogg',
  oga: 'audio/ogg',
  mp4: 'video/mp4',
  m4v: 'video/mp4',
  mov: 'video/quicktime',
  m3u8: 'application/x-mpegURL',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  gif: 'image/gif',
  avif: 'image/avif',
};

export function extensionOf(url: string): string {
  const path = url.split('?')[0];
  const match = /\.([a-z0-9]{2,5})$/i.exec(path);
  return match ? match[1].toLowerCase() : '';
}

export function mimeFor(url: string, kind: MediaKind): string {
  const ext = extensionOf(url);
  if (ext === 'webm')
    return kind === MediaKind.AUDIO ? 'audio/webm' : 'video/webm';
  return MIME[ext] ?? `${kind}/${ext || '*'}`;
}

export function guessKind(url: string): MediaKind | null {
  if (extensionOf(url) === 'webm') return MediaKind.VIDEO;
  const type = MIME[extensionOf(url)] ?? '';
  if (type.startsWith('audio/')) return MediaKind.AUDIO;
  if (type.startsWith('video/') || type === 'application/x-mpegURL')
    return MediaKind.VIDEO;
  if (type.startsWith('image/')) return MediaKind.IMAGE;
  return null;
}

function sourcesFor(
  kind: MediaKind,
  urls: Array<string | undefined>,
): PlaybackSource[] {
  if (kind === MediaKind.IMAGE) return [];
  const seen = new Set<string>();
  return urls
    .filter((u): u is string => !!u && !seen.has(u) && !!seen.add(u))
    .map((src) => ({ src, type: mimeFor(src, kind) }));
}

export function toPlayback(asset: MediaAsset): MediaPlayback {
  return {
    id: asset.id,
    kind: asset.kind,
    format: asset.format,
    durationSeconds: asset.durationSeconds,
    width: asset.width,
    height: asset.height,
    bytes: asset.bytes,
    url: asset.url,
    optimizedUrl: asset.optimizedUrl,
    streamingUrl: asset.streamingUrl,
    thumbnailUrl: asset.thumbnailUrl,
    sources: sourcesFor(asset.kind, [
      asset.streamingUrl,
      asset.optimizedUrl,
      asset.url,
    ]),
  };
}

/** Playback for a URL that is not a registered asset (e.g. an external link). */
export function externalPlayback(url: string, kind: MediaKind): MediaPlayback {
  return {
    id: null,
    kind,
    format: extensionOf(url) || undefined,
    url,
    optimizedUrl: url,
    sources: sourcesFor(kind, [url]),
  };
}
