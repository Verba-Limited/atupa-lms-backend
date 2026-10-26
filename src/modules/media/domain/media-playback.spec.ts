import { MediaAsset, MediaKind, MediaPurpose } from './media-asset.entity';
import {
  externalPlayback,
  guessKind,
  mimeFor,
  toPlayback,
} from './media-playback';

const asset = (overrides: Partial<MediaAsset>): MediaAsset => ({
  id: 'a1',
  provider: 'cloudinary',
  publicId: 'p',
  kind: MediaKind.VIDEO,
  purpose: MediaPurpose.CONTENT,
  bytes: 10,
  url: 'https://res.cloudinary.com/x/video/upload/v1/clip.mov',
  optimizedUrl: 'https://res.cloudinary.com/x/video/upload/q_auto/v1/clip.mp4',
  streamingUrl:
    'https://res.cloudinary.com/x/video/upload/sp_auto/v1/clip.m3u8',
  thumbnailUrl: 'https://res.cloudinary.com/x/video/upload/v1/clip.jpg',
  ownerUserId: 'u',
  ...overrides,
});

describe('media playback', () => {
  it('orders video sources: adaptive stream, compressed mp4, original', () => {
    expect(toPlayback(asset({})).sources).toEqual([
      { src: expect.stringContaining('.m3u8'), type: 'application/x-mpegURL' },
      { src: expect.stringContaining('q_auto'), type: 'video/mp4' },
      { src: expect.stringContaining('clip.mov'), type: 'video/quicktime' },
    ]);
  });

  it('lists compressed mp3 before the original audio', () => {
    const p = toPlayback(
      asset({
        kind: MediaKind.AUDIO,
        url: 'https://cdn/x.wav',
        optimizedUrl: 'https://cdn/x.mp3?_a=1',
        streamingUrl: undefined,
      }),
    );
    expect(p.sources.map((s) => s.type)).toEqual(['audio/mpeg', 'audio/wav']);
  });

  it('does not duplicate identical urls (local storage)', () => {
    const p = toPlayback(
      asset({
        kind: MediaKind.AUDIO,
        url: 'http://h/a.mp3',
        optimizedUrl: 'http://h/a.mp3',
        streamingUrl: undefined,
      }),
    );
    expect(p.sources).toHaveLength(1);
  });

  it('builds playback for external links and guesses types', () => {
    expect(
      externalPlayback('https://x.com/a.mp3', MediaKind.AUDIO),
    ).toMatchObject({
      id: null,
      sources: [{ src: 'https://x.com/a.mp3', type: 'audio/mpeg' }],
    });
    expect(
      externalPlayback('https://x.com/a.png', MediaKind.IMAGE).sources,
    ).toEqual([]);
    expect(guessKind('https://x.com/v.webm?x=1')).toBe(MediaKind.VIDEO);
    expect(guessKind('https://x.com/page')).toBeNull();
    expect(mimeFor('https://x.com/a.webm', MediaKind.AUDIO)).toBe('audio/webm');
  });
});
