import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  Logger,
} from '@nestjs/common';
import { ErrorCode, errorMessage } from '@hc/shared';
import { randomUUID } from 'crypto';
import type { Request, Response } from 'express';
import { BizException } from '../exceptions/biz.exception';

/**
 * 全局异常过滤器：统一错误响应结构，业务异常返回 HTTP 200 + 业务码。
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request & { traceId?: string }>();
    const traceId = request.traceId ?? randomUUID();

    // 1. 业务异常：HTTP 200，业务码交给前端判断
    if (exception instanceof BizException) {
      response.status(200).json({
        code: exception.code,
        message: exception.message,
        data: null,
        traceId,
      });
      return;
    }

    // 2. 框架异常（参数校验、404 等）
    if (exception instanceof HttpException) {
      const body = exception.getResponse();
      const rawMessage =
        typeof body === 'string' ? body : ((body as Record<string, unknown>).message ?? exception.message);
      const message = Array.isArray(rawMessage) ? rawMessage.join('；') : String(rawMessage);

      response.status(200).json({
        code: ErrorCode.PARAM_INVALID,
        message,
        data: null,
        traceId,
      });
      return;
    }

    // 3. 未知异常：记录日志，对外不暴露细节
    const detail = exception instanceof Error ? exception.stack ?? exception.message : String(exception);
    this.logger.error(`未处理异常 [${request.method} ${request.url}] traceId=${traceId}\n${detail}`);

    response.status(500).json({
      code: ErrorCode.SYSTEM_ERROR,
      message: errorMessage(ErrorCode.SYSTEM_ERROR),
      data: null,
      traceId,
    });
  }
}
