import { UserRole } from '../../../../shared/domain/user-role';

export const TOKEN_ISSUER = Symbol('TOKEN_ISSUER');

export interface AccessTokenClaims {
  sub: string;
  email: string;
  role: UserRole;
  schoolId?: string | null;
}

export interface TokenIssuer {
  signAccess(claims: AccessTokenClaims): Promise<string>;
  signRefresh(userId: string): Promise<string>;
  /** Returns the subject (user id) or throws if invalid/expired. */
  verifyRefresh(token: string): Promise<{ sub: string }>;
  readonly accessTtlSeconds: number;
}
