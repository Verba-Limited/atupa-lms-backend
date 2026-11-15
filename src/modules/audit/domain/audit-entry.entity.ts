/** One recorded staff action (M-24). Entries are kept indefinitely. */
export interface AuditEntry {
  id: string;
  actorId: string;
  actorEmail: string;
  actorRole: string;
  /** e.g. "admin.users.update" or "PATCH /admin/users/:userId". */
  action: string;
  method: string;
  path: string;
  targetId?: string | null;
  /** Request body with secrets removed and long text shortened. */
  details?: Record<string, unknown> | null;
  statusCode: number;
  ip?: string | null;
  createdAt?: Date;
}

const SECRET_KEYS = new Set([
  'password',
  'currentPassword',
  'newPassword',
  'token',
  'refreshToken',
  'accessToken',
  'signature',
]);
const MAX_TEXT = 300;
const MAX_DEPTH = 4;
const MAX_ITEMS = 20;

/** Keeps the log useful and safe: no secrets, no huge payloads. */
export function sanitizeDetails(value: unknown, depth = 0): unknown {
  if (value === null || value === undefined) return value;
  if (typeof value === 'string') {
    return value.length > MAX_TEXT ? `${value.slice(0, MAX_TEXT)}…` : value;
  }
  if (typeof value !== 'object') return value;
  if (depth >= MAX_DEPTH) return '[…]';
  if (Array.isArray(value)) {
    const items = value
      .slice(0, MAX_ITEMS)
      .map((v) => sanitizeDetails(v, depth + 1));
    return value.length > MAX_ITEMS
      ? [...items, `… ${value.length - MAX_ITEMS} more`]
      : items;
  }
  if (value instanceof Date) return value;
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([k, v]) => [
      k,
      SECRET_KEYS.has(k) ? '[redacted]' : sanitizeDetails(v, depth + 1),
    ]),
  );
}
