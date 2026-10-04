import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { PrincipalType } from '@hc/shared';
import type { Request } from 'express';

export interface JwtPayload {
  sub: string;
  type: PrincipalType;
  openid?: string;
  staffId?: string;
  adminId?: string;
  adminRole?: string;
  roleIds?: string[];
  exp?: number;
  iat?: number;
}

/** 从请求中取出当前登录主体（由 JwtAuthGuard 注入） */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): JwtPayload => {
    const request = ctx.switchToHttp().getRequest<Request & { user?: JwtPayload }>();
    return request.user as JwtPayload;
  },
);
