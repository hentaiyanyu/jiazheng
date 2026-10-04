import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { ErrorCode, PrincipalType } from '@hc/shared';
import { BizException } from '../../common/exceptions/biz.exception';
import { PrismaService } from '../../prisma/prisma.service';
import { toUserVo } from '../user/vo/user.vo';
import { LoginDto } from './dto/login.dto';
import { WechatService } from './wechat.service';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
    private readonly wechat: WechatService,
  ) {}

  /** 微信登录：code -> openid -> 创建/查询用户 -> 签发令牌 */
  async login(dto: LoginDto) {
    const session = await this.wechat.code2session(dto.code);

    const user = await this.prisma.user.upsert({
      where: { openid: session.openid },
      update: {
        unionid: session.unionid ?? undefined,
        lastLoginAt: new Date(),
      },
      create: {
        openid: session.openid,
        unionid: session.unionid ?? null,
        lastLoginAt: new Date(),
      },
    });

    if (user.status !== 1) {
      throw new BizException(ErrorCode.FORBIDDEN, '账号已被限制使用，请联系客服');
    }

    const tokens = await this.issueTokens(user.id, user.openid);
    this.logger.log(`用户登录成功 userId=${user.id}`);

    return { ...tokens, userInfo: toUserVo(user) };
  }

  /** 用 refreshToken 换取新的令牌 */
  async refresh(refreshToken: string) {
    let payload: { sub: string; type: string };
    try {
      payload = await this.jwtService.verifyAsync(refreshToken);
    } catch {
      throw new BizException(ErrorCode.TOKEN_EXPIRED);
    }

    if (payload.type !== 'REFRESH') {
      throw new BizException(ErrorCode.TOKEN_INVALID);
    }

    let userId: bigint;
    try {
      userId = BigInt(payload.sub);
    } catch {
      throw new BizException(ErrorCode.TOKEN_INVALID);
    }

    const user = await this.prisma.user.findFirst({ where: { id: userId, deletedAt: null } });
    if (!user) {
      throw new BizException(ErrorCode.USER_NOT_FOUND);
    }

    return this.issueTokens(user.id, user.openid);
  }

  private async issueTokens(userId: bigint, openid: string) {
    const accessPayload = {
      sub: userId.toString(),
      type: PrincipalType.USER,
      openid,
    };

    const token = await this.jwtService.signAsync(accessPayload);
    const refreshToken = await this.jwtService.signAsync(
      { sub: userId.toString(), type: 'REFRESH' },
      { expiresIn: this.config.get<string>('JWT_REFRESH_EXPIRES_IN') ?? '7d' },
    );

    return { token, refreshToken };
  }
}
