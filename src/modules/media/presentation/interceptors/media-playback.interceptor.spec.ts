import { MediaService } from '../../application/media.service';
import { MediaKind } from '../../domain/media-asset.entity';
import { externalPlayback } from '../../domain/media-playback';
import { MediaPlaybackInterceptor } from './media-playback.interceptor';

describe('MediaPlaybackInterceptor', () => {
  const resolveUrls = jest.fn((urls: string[], kind?: MediaKind) =>
    Promise.resolve(
      new Map(
        urls.map((u) => [u, externalPlayback(u, kind ?? MediaKind.VIDEO)]),
      ),
    ),
  );
  const interceptor = new MediaPlaybackInterceptor({
    resolveUrls,
  } as unknown as MediaService);

  beforeEach(() => resolveUrls.mockClear());

  it('adds playback next to every known media field, at any depth', async () => {
    const body = {
      success: true,
      data: {
        coverImageUrl: 'https://cdn/cover.png',
        teacher: { profileImageUrl: 'https://cdn/me.jpg' },
        blocks: [
          { type: 'video', mediaUrl: 'https://cdn/v.mp4' },
          { type: 'text' },
        ],
        vocabulary: [
          { audioUrl: 'https://cdn/w.mp3', imageUrl: 'https://cdn/w.png' },
        ],
        submission: { mediaUrls: ['https://cdn/rec.mp3'] },
        launchUrl: 'https://game.example/play',
      },
    };
    const out = (await interceptor.enrich(body)) as typeof body & {
      data: Record<string, any>;
    };
    expect(out.data.coverImage).toMatchObject({ kind: 'image' });
    expect(out.data.teacher.profileImage).toMatchObject({ kind: 'image' });
    expect(out.data.blocks[0].media).toMatchObject({
      url: 'https://cdn/v.mp4',
    });
    expect(out.data.blocks[1]).toEqual({ type: 'text' });
    expect(out.data.vocabulary[0].audio).toMatchObject({ kind: 'audio' });
    expect(out.data.vocabulary[0].image).toMatchObject({ kind: 'image' });
    expect(out.data.submission.media).toEqual([
      expect.objectContaining({ url: 'https://cdn/rec.mp3' }),
    ]);
    expect(out.data).not.toHaveProperty('launch');
  });

  it('keeps playback a use case already provided and skips bodies without media', async () => {
    const preset = { mediaUrl: 'https://cdn/a.mp3', media: { custom: true } };
    expect(await interceptor.enrich({ data: preset })).toEqual({
      data: preset,
    });
    const plain = { data: { title: 'x', when: new Date(0) } };
    expect(await interceptor.enrich(plain)).toBe(plain);
    expect(resolveUrls).not.toHaveBeenCalled();
  });

  it('returns null playback for empty urls', async () => {
    const out = (await interceptor.enrich({ data: { mediaUrl: '' } })) as {
      data: Record<string, unknown>;
    };
    expect(out.data.media).toBeNull();
  });
});
