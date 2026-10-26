import { mediaUrlsIn } from './lesson-player.service';

describe('mediaUrlsIn', () => {
  it('finds links anywhere in an activity payload', () => {
    expect(
      mediaUrlsIn({
        audioUrl: 'https://cdn/a.mp3',
        choices: ['Ajá', 'Ológbò'],
        cards: [{ front: 'x', imageUrl: 'http://cdn/b.png' }],
        note: 'not a link',
      }),
    ).toEqual(['https://cdn/a.mp3', 'http://cdn/b.png']);
  });
});
