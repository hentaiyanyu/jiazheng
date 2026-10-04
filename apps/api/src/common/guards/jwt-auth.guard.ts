import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { ErrorCode } from '@hc/shared';
import type { Request } from 'express';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import type { JwtPayload } from '../decorators/current-user.decorator';
import { BizException } from '../exceptions/biz.exception';

/**
 * 全局登录守卫：除 @Public() 标记的接口外，全部要求携带有效 token。
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request & { user?: JwtPayload }>();
    const authorization = request.headers['authorization'];

    if (!authorization || !authorization.startsWith('Bearer ')) {
      throw new BizException(ErrorCode.UNAUTHORIZED);
    }

    const token = authorization.slice('Bearer '.length).trim();

    try {
      const payload = await this.jwtService.verifyAsync<JwtPayload>(token);
      if (payload.type === ('REFRESH' as unknown as JwtPayload['type'])) {
        // 刷新令牌不能当访问令牌用
        throw new BizException(ErrorCode.TOKEN_INVALID);
      }
      request.user = payload;
      return true;
    } catch (error) {
      if (error instanceof BizException) {
        throw error;
      }
      throw new BizException(ErrorCode.TOKEN_EXPIRED);
    }
  }
}
