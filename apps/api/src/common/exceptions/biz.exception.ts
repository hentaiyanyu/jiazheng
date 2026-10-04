import { ErrorCode, errorMessage } from '@hc/shared';

/**
 * 业务异常：抛出后由全局异常过滤器转成 { code, message } 返回给前端。
 */
export class BizException extends Error {
  readonly code: number;

  constructor(code: number = ErrorCode.SYSTEM_ERROR, message?: string) {
    super(message ?? errorMessage(code));
    this.name = 'BizException';
    this.code = code;
  }
}
