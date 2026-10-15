import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { Actor } from '../../application/actor';

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): Actor => {
    const request = ctx.switchToHttp().getRequest<{ user: Actor }>();
    return request.user;
  },
);
