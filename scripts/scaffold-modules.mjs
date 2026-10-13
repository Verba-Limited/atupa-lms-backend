import fs from 'fs';
import path from 'path';

const root = path.resolve('src');

const files = {
  'common/decorators/roles.decorator.ts': `import { SetMetadata } from '@nestjs/common';
import { UserRole } from '../enums/user-role.enum';

export const ROLES_KEY = 'roles';
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);
`,
  'common/decorators/current-user.decorator.ts': `import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    return request.user;
  },
);
`,
  'common/guards/jwt-auth.guard.ts': `import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {}
`,
  'common/guards/roles.guard.ts': `import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { UserRole } from '../enums/user-role.enum';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!requiredRoles?.length) {
      return true;
    }
    const { user } = context.switchToHttp().getRequest();
    if (!user?.role || !requiredRoles.includes(user.role)) {
      throw new ForbiddenException('Insufficient permissions for this action');
    }
    return true;
  }
}
`,
  'common/dto/pagination-query.dto.ts': `import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

export class PaginationQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;
}
`,
  'common/interfaces/authenticated-user.interface.ts': `import { UserRole } from '../enums/user-role.enum';

export interface AuthenticatedUser {
  userId: string;
  email: string;
  role: UserRole;
  schoolId?: string;
}
`,
  'common/tokens/repository.tokens.ts': `export const USER_REPOSITORY = Symbol('USER_REPOSITORY');
export const LANGUAGE_REPOSITORY = Symbol('LANGUAGE_REPOSITORY');
export const COURSE_REPOSITORY = Symbol('COURSE_REPOSITORY');
export const PROGRESS_REPOSITORY = Symbol('PROGRESS_REPOSITORY');
export const NOTIFICATION_PORT = Symbol('NOTIFICATION_PORT');
export const PAYMENT_PORT = Symbol('PAYMENT_PORT');
`,
  'common/utils/api-response.ts': `export function ok<T>(data: T, message = 'Success') {
  return { success: true, message, data };
}
`,
};

for (const [rel, content] of Object.entries(files)) {
  const full = path.join(root, rel);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, content);
}

console.log(`Wrote ${Object.keys(files).length} common files`);
