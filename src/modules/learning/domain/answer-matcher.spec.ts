import { matchAnswer, normalizeAnswer } from './answer-matcher';

describe('answer matcher', () => {
  it('ignores case, spacing, trailing punctuation and tone marks by default', () => {
    expect(normalizeAnswer('  Ẹ   kú àárọ̀! ')).toBe('e ku aaro');
    expect(matchAnswer('Ẹ kú àárọ̀', 'e ku aaro')).toBe(true);
  });

  it('can require exact diacritics', () => {
    expect(matchAnswer('Ẹ ṣé', 'e se', { strictDiacritics: true })).toBe(false);
    expect(matchAnswer('Ẹ ṣé', 'ẹ ṣé', { strictDiacritics: true })).toBe(true);
  });

  it('accepts alternative spellings', () => {
    expect(matchAnswer('Daalụ', 'dalu', { acceptedAnswers: ['dalu'] })).toBe(
      true,
    );
  });

  it('compares arrays as sets unless ordered', () => {
    expect(matchAnswer(['a', 'b'], ['B', 'a'])).toBe(true);
    expect(
      matchAnswer(['mo', 'fẹ', 'jẹun'], ['fẹ', 'mo', 'jẹun'], {
        ordered: true,
      }),
    ).toBe(false);
    expect(
      matchAnswer(['mo', 'fẹ', 'jẹun'], ['mo', 'fe', 'jeun'], {
        ordered: true,
      }),
    ).toBe(true);
    expect(matchAnswer(['a', 'b'], ['a'])).toBe(false);
  });

  it('matches { left: right } maps exactly', () => {
    const key = { Lion: 'Kìnnìún', Dog: 'Ajá' };
    expect(matchAnswer(key, { Dog: 'aja', Lion: 'kinniun' })).toBe(true);
    expect(matchAnswer(key, { Dog: 'Kìnnìún', Lion: 'Ajá' })).toBe(false);
    expect(matchAnswer(key, { Lion: 'Kìnnìún', Dog: 'Ajá', Cat: 'x' })).toBe(
      false,
    );
  });

  it('rejects missing or wrongly-shaped answers', () => {
    expect(matchAnswer('a', undefined)).toBe(false);
    expect(matchAnswer('a', ['a'])).toBe(false);
    expect(matchAnswer(['a'], 'a')).toBe(false);
  });
});
