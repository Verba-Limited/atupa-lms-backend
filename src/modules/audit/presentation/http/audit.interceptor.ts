import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { Observable, tap } from 'rxjs';
import type { Actor } from '../../../../shared/application/actor';
import { UserRole } from '../../../../shared/domain/user-role';
import { AuditService } from '../../application/audit.service';

/** Learners and parents are not recorded; their actions are personal. */
const UNRECORDED_ROLES = [UserRole.LEARNER, UserRole.PARENT];

/** Personal or high-volume routes that are not admin actions. */
const SKIPPED_PREFIXES = [
  'auth/',
  'progress/',
  'learning/',
  'notifications',
  'media/playback',
  'gamecard/scan',
  'users/me',
];

const VERBS: Record<string, string> = {
  POST: 'create',
  PUT: 'update',
  PATCH: 'update',
  DELETE: 'delete',
};

/** "POST /authoring/courses/:courseId/publish" -> "authoring.courses.publish" */
export function actionName(method: string, routePath: string): string {
  const parts = routePath.split('/').filter(Boolean);
  const named = parts.filter((p) => !p.startsWith(':'));
  const lastIsParam = parts[parts.length - 1]?.startsWith(':');
  const endsWithAction =
    method === 'POST' && !lastIsParam && parts.length > 2 && named.length > 2;
  return endsWithAction
    ? named.join('.')
    : [...named, VERBS[method] ?? method.toLowerCase()].join('.');
}

/**
 * Records every successful change made by staff, school admins and
 * teachers: who, what, which record, when and from where (M-24).
 */
@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(private readonly audit: AuditService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') return next.handle();
    const http = context.switchToHttp();
    const req = http.getRequest<Request & { user?: Actor }>();
    if (req.method === 'GET' || req.method === 'HEAD') return next.handle();
    return next.handle().pipe(
      tap(() => {
        const actor = req.user;
        if (!actor || UNRECORDED_ROLES.includes(actor.role)) return;
        const routePath = String(
          (req.route as { path?: string } | undefined)?.path ?? req.path,
        ).replace(/^\/?api\/v1\/?/, '');
        if (SKIPPED_PREFIXES.some((p) => routePath.startsWith(p))) return;
        const params = Object.values(req.params ?? {});
        void this.audit.record({
          actorId: actor.userId,
          actorEmail: actor.email,
          actorRole: actor.role,
          action: actionName(req.method, routePath),
          method: req.method,
          path: `/${routePath}`,
          targetId: params.length ? String(params[params.length - 1]) : null,
          details: req.body as unknown,
          statusCode: http.getResponse<Response>().statusCode,
          ip: req.ip ?? null,
        });
      }),
    );
  }
}
