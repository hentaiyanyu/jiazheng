import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { ErrorCode } from '@hc/shared';
import { randomUUID } from 'crypto';
import type { Request } from 'express';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

/**
 * 统一成功响应结构：{ code: 0, message: 'ok', data, traceId }
 */
@Injectable()
export class ResponseInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<Request & { traceId?: string }>();
    const traceId = (request.headers['x-trace-id'] as string) ?? randomUUID();
    request.traceId = traceId;

    // 便于排查：记录链路 ID，响应头一并返回
    const response = context.switchToHttp().getResponse();
    response.setHeader('x-trace-id', traceId);

    return next.handle().pipe(
      map((data) => ({
        code: ErrorCode.OK,
        message: 'ok',
        data: data ?? null,
        traceId,
      })),
    );
  }
}
