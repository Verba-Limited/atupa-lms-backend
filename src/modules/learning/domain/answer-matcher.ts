import type { AnswerValue } from '../../catalog';

export interface MatchOptions {
  acceptedAnswers?: string[];
  /** For array answers (e.g. word arrangement): order matters. */
  ordered?: boolean;
  /** Require exact tone marks/diacritics (default: lenient). */
  strictDiacritics?: boolean;
}

/**
 * Normalises learner input. By default tone marks are ignored so a learner
 * typing "e kaaro" on a phone keyboard matches "ẹ kààrọ̀".
 */
export function normalizeAnswer(
  value: unknown,
  strictDiacritics = false,
): string {
  const raw =
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
      ? String(value)
      : '';
  let text = raw
    .normalize('NFC')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[.!?]+$/, '');
  if (!strictDiacritics) {
    text = text.normalize('NFD').replace(/\p{M}/gu, '');
  }
  return text;
}

export function matchAnswer(
  expected: AnswerValue,
  actual: unknown,
  options: MatchOptions = {},
): boolean {
  if (actual === undefined || actual === null) return false;
  const norm = (v: unknown) => normalizeAnswer(v, options.strictDiacritics);

  if (
    typeof expected === 'string' ||
    typeof expected === 'number' ||
    typeof expected === 'boolean'
  ) {
    if (typeof actual === 'object') return false;
    const candidates = [expected, ...(options.acceptedAnswers ?? [])].map(norm);
    return candidates.includes(norm(actual));
  }

  if (Array.isArray(expected)) {
    if (!Array.isArray(actual) || actual.length !== expected.length)
      return false;
    const left = expected.map(norm);
    const right = actual.map(norm);
    if (!options.ordered) {
      left.sort();
      right.sort();
    }
    return left.every((value, index) => value === right[index]);
  }

  if (expected && typeof expected === 'object') {
    if (typeof actual !== 'object' || Array.isArray(actual)) return false;
    const exp = expected as Record<string, unknown>;
    const act = actual as Record<string, unknown>;
    const keys = Object.keys(exp);
    return (
      keys.length === Object.keys(act).length &&
      keys.every((key) => norm(exp[key]) === norm(act[key]))
    );
  }
  return false;
}
