import { Injectable } from '@nestjs/common';
import { ErrorCode } from '@hc/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { BizException } from '../../common/exceptions/biz.exception';
import { toUserVo } from './vo/user.vo';

@Injectable()
export class UserService {
  constructor(private readonly prisma: PrismaService) {}

  async findById(userId: bigint) {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
    });
    if (!user) {
      throw new BizException(ErrorCode.USER_NOT_FOUND);
    }
    return user;
  }

  async getProfile(userId: bigint) {
    const user = await this.findById(userId);
    return toUserVo(user);
  }

  async bindPhone(userId: bigint, code: string) {
    const user = await this.findById(userId);

    // TODO(Sprint 1)：调用微信 getPhoneNumber 接口换取真实手机号，并做 AES 加密后落库
    // 当前为开发期模拟：传入 11 位手机号则直接使用，否则生成一个测试号
    const phone = /^1\d{10}$/.test(code) ? code : `138${String(Date.now()).slice(-8)}`;

    const updated = await this.prisma.user.update({
      where: { id: user.id },
      data: { phone },
    });

    return toUserVo(updated);
  }
}
