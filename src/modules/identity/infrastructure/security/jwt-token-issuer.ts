import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { randomUUID } from 'crypto';
import { AppConfig } from '../../../../config/app-config';
import {
  AccessTokenClaims,
  TokenIssuer,
} from '../../application/ports/token-issuer.port';

@Injectable()
export class JwtTokenIssuer implements TokenIssuer {
  constructor(
    private readonly jwt: JwtService,
    private readonly config: AppConfig,
  ) {}

  get accessTtlSeconds(): number {
    return this.config.jwt.accessTtlSeconds;
  }

  signAccess(claims: AccessTokenClaims): Promise<string> {
    return this.jwt.signAsync(
      { ...claims, typ: 'access' },
      {
        secret: this.config.jwt.accessSecret,
        expiresIn: this.config.jwt.accessTtlSeconds,
      },
    );
  }

  signRefresh(userId: string): Promise<string> {
    return this.jwt.signAsync(
      { sub: userId, typ: 'refresh', jti: randomUUID() },
      {
        secret: this.config.jwt.refreshSecret,
        expiresIn: this.config.jwt.refreshTtlSeconds,
      },
    );
  }

  async verifyRefresh(token: string): Promise<{ sub: string }> {
    const payload = await this.jwt.verifyAsync<{ sub: string; typ?: string }>(
      token,
      { secret: this.config.jwt.refreshSecret },
    );
    if (payload.typ !== 'refresh') throw new Error('Not a refresh token');
    return { sub: payload.sub };
  }
}
