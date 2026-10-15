/**
 * Validates environment variables at boot so misconfiguration fails fast
 * instead of surfacing as runtime errors (or silently weak security).
 */
const WEAK_SECRETS = new Set([
  'change_me_in_production',
  'change_me_refresh_in_production',
  'secret',
]);

export function validateEnv(
  config: Record<string, unknown>,
): Record<string, unknown> {
  const errors: string[] = [];
  const isProduction = config.NODE_ENV === 'production';

  for (const key of ['JWT_SECRET', 'JWT_REFRESH_SECRET']) {
    const value = config[key];
    if (typeof value !== 'string' || !value) {
      errors.push(`${key} is required`);
    } else if (isProduction && (value.length < 32 || WEAK_SECRETS.has(value))) {
      errors.push(`${key} must be a strong secret (32+ chars) in production`);
    }
  }
  if (config.JWT_SECRET && config.JWT_SECRET === config.JWT_REFRESH_SECRET) {
    errors.push('JWT_SECRET and JWT_REFRESH_SECRET must differ');
  }
  if (isProduction && !config.MONGODB_URI) {
    errors.push('MONGODB_URI is required in production');
  }

  if (errors.length) {
    throw new Error(
      `Invalid environment configuration:\n- ${errors.join('\n- ')}`,
    );
  }
  return config;
}
