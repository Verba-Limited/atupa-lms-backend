/** Escapes user input so it can be used literally inside a RegExp. */
export function escapeRegex(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Case-insensitive "contains" matcher that is safe for untrusted input. */
export function containsPattern(input: string, maxLength = 100): RegExp {
  return new RegExp(escapeRegex(input.trim().slice(0, maxLength)), 'i');
}

export function displayName(user: {
  firstName?: string;
  lastName?: string;
  email?: string;
}): string {
  const name = [user.firstName, user.lastName].filter(Boolean).join(' ');
  return name || user.email || 'Learner';
}

/** "Ada Obi" -> "Ada O." for child-safe public listings. */
export function shortName(user: { firstName?: string; lastName?: string }) {
  const last = user.lastName ? ` ${user.lastName.charAt(0)}.` : '';
  return `${user.firstName ?? 'Learner'}${last}`;
}

export function todayKey(date = new Date()): string {
  return date.toISOString().slice(0, 10);
}
