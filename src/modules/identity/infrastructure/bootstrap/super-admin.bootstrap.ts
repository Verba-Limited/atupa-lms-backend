import {
  Inject,
  Injectable,
  Logger,
  OnApplicationBootstrap,
} from '@nestjs/common';
import { AppConfig } from '../../../../config/app-config';
import { UserRole } from '../../../../shared/domain/user-role';
import { AuthService } from '../../application/auth.service';
import type { UserRepository } from '../../application/ports/user.repository.port';
import { USER_REPOSITORY } from '../../application/ports/user.repository.port';

/**
 * Super admins cannot self-register. The first one is created from
 * SUPER_ADMIN_EMAIL / SUPER_ADMIN_PASSWORD when no super admin exists yet.
 */
@Injectable()
export class SuperAdminBootstrap implements OnApplicationBootstrap {
  private readonly logger = new Logger(SuperAdminBootstrap.name);

  constructor(
    private readonly config: AppConfig,
    private readonly auth: AuthService,
    @Inject(USER_REPOSITORY) private readonly users: UserRepository,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    const seed = this.config.superAdminBootstrap;
    if (!seed) return;
    const existing = await this.users.list(
      { role: UserRole.SUPER_ADMIN },
      { page: 1, limit: 1 },
    );
    if (existing.total > 0 || (await this.users.findByEmail(seed.email)))
      return;
    await this.auth.createAccount({
      email: seed.email,
      password: seed.password,
      role: UserRole.SUPER_ADMIN,
      firstName: 'ATUPA',
      lastName: 'Admin',
    });
    this.logger.log(`Bootstrapped super admin ${seed.email}`);
  }
}
