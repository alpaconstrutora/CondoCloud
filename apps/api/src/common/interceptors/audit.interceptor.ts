import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import type { Queue } from 'bull';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { QUEUE_NAMES } from '@condocloud/shared';
import type { Profile } from '@condocloud/shared';
import { Request } from 'express';

const WRITE_METHODS = new Set(['POST', 'PATCH', 'PUT', 'DELETE']);

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(
    @InjectQueue(QUEUE_NAMES.AUDIT) private readonly auditQueue: Queue,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<
      Request & { user?: Profile; condominiumId?: string }
    >();

    if (!WRITE_METHODS.has(request.method)) return next.handle();

    return next.handle().pipe(
      tap(() => {
        // Fire-and-forget: falha no audit não afeta o fluxo principal
        void this.auditQueue.add('log', {
          action: `${request.method} ${request.path}`,
          condominium_id: request.condominiumId,
          profile_id: request.user?.id,
          entity_type: this.extractEntityType(request.path),
          payload: this.sanitizeBody(request.body as Record<string, unknown>),
          ip_address: request.ip,
        });
      }),
    );
  }

  private extractEntityType(path: string): string {
    const segments = path.split('/').filter(Boolean);
    return segments[0] ?? 'unknown';
  }

  private sanitizeBody(body: Record<string, unknown>): Record<string, unknown> {
    const sensitive = new Set(['password', 'token', 'secret', 'key']);
    return Object.fromEntries(
      Object.entries(body ?? {})
        .filter(([key]) => !sensitive.has(key))
        .slice(0, 20), // truncar payload grande
    );
  }
}
