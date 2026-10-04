import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { ErrorCode, PrincipalType } from '@hc/shared';
import type { Request } from 'express';
import { BizException } from '../../common/exceptions/biz.exception';
import type { JwtPayload } from '../../common/decorators/current-user.decorator';

// 保洁师专用守卫：全局登录守卫之后执行，校验令牌主体类型
@Injectable()
export class StaffGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request & { user?: JwtPayload }>();
    const user = request.user;

    if (!user || user.type !== PrincipalType.STAFF || !user.staffId) {
      throw new BizException(ErrorCode.FORBIDDEN, '请使用保洁师账号登录');
    }

    return true;
  }
}
