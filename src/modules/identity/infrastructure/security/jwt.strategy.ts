import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { AppConfig } from '../../../../config/app-config';
import type { Actor } from '../../../../shared/application/actor';
import type { UserRepository } from '../../application/ports/user.repository.port';
import { USER_REPOSITORY } from '../../application/ports/user.repository.port';

interface AccessPayload {
  sub: string;
  typ?: string;
}

/**
 * Validates the access token, then loads the user so that deactivation,
 * role changes and school membership changes take effect immediately.
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: AppConfig,
    @Inject(USER_REPOSITORY) private readonly users: UserRepository,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.jwt.accessSecret,
    });
  }

  async validate(payload: AccessPayload): Promise<Actor> {
    if (payload.typ !== 'access') {
      throw new UnauthorizedException('Invalid access token');
    }
    const user = await this.users.findById(payload.sub);
    if (!user || !user.isActive) {
      throw new UnauthorizedException(
        'Account is inactive or no longer exists',
      );
    }
    return {
      userId: user.id,
      email: user.email,
      role: user.role,
      schoolId: user.schoolId ?? undefined,
    };
  }
}
