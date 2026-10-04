import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { ErrorCode, PrincipalType } from '@hc/shared';
import type { Request } from 'express';
import { BizException } from '../../common/exceptions/biz.exception';
import type { JwtPayload } from '../../common/decorators/current-user.decorator';

// 后台守卫：校验令牌主体类型为 ADMIN
@Injectable()
export class AdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request & { user?: JwtPayload }>();
    const user = request.user;

    if (!user || user.type !== PrincipalType.ADMIN || !user.adminId) {
      throw new BizException(ErrorCode.FORBIDDEN, '请使用管理员账号登录');
    }

    return true;
  }
}
