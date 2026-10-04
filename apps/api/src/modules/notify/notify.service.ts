import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { NotifyQueryDto } from './dto/notify.dto';

export type ReceiverType = 'USER' | 'STAFF';

export interface NotifyInput {
  receiverType: ReceiverType;
  receiverId: bigint;
  // 消息类型：ORDER_STATUS / DISPATCH / SYSTEM
  type: string;
  title: string;
  content: string;
  orderId?: bigint | null;
  page?: string | null;
  // 微信订阅消息模板的键（对应 .env 中的 WX_TEMPLATE_xxx）
  templateKey?: string;
}

@Injectable()
export class NotifyService {
  private readonly logger = new Logger(NotifyService.name);

  private accessToken = '';
  private accessTokenExpireAt = 0;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  /**
   * 发送通知：先落站内消息（一定成功），再尝试微信订阅消息（需要模板 ID）。
   * 即使微信通道失败，站内消息依然保留，用户下次打开小程序能看到。
   */
  async send(input: NotifyInput) {
    const notification = await this.prisma.notification.create({
      data: {
        receiverType: input.receiverType,
        receiverId: input.receiverId,
        type: input.type,
        title: input.title,
        content: input.content,
        orderId: input.orderId ?? null,
        page: input.page ?? null,
      },
    });

    try {
      const result = await this.sendWechatMessage(input);
      await this.prisma.notification.update({
        where: { id: notification.id },
        data: { wxStatus: result.status, wxError: result.error ?? null },
      });
    } catch (error) {
      this.logger.warn(`微信订阅消息发送失败：${(error as Error).message}`);
    }

    return notification;
  }

  private isMockMode(): boolean {
    return (this.config.get<string>('WX_MOCK') ?? 'true') !== 'false';
  }

  private async sendWechatMessage(
    input: NotifyInput,
  ): Promise<{ status: string; error?: string }> {
    if (!input.templateKey) {
      return { status: 'SKIPPED', error: '未配置模板键' };
    }

    const templateId = this.config.get<string>(`WX_TEMPLATE_${input.templateKey}`) ?? '';

    if (this.isMockMode() || !templateId) {
      this.logger.log(`[模拟订阅消息] 发往 ${input.receiverType}#${input.receiverId}：${input.title}`);
      return { status: 'MOCK', error: templateId ? undefined : '未配置模板 ID' };
    }

    const openid = await this.resolveOpenid(input.receiverType, input.receiverId);
    if (!openid) {
      return { status: 'SKIPPED', error: '接收人缺少 openid' };
    }

    try {
      const token = await this.getAccessToken();
      const url = `https://api.weixin.qq.com/cgi-bin/message/subscribe/send?access_token=${token}`;

      const response = await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        // TODO(接入订阅消息时)：data 的字段名（thing1、time2 等）必须与微信后台模板一致，
        // 拿到模板后在这里按模板字段映射。
        body: JSON.stringify({
          touser: openid,
          template_id: templateId,
          page: input.page ?? undefined,
          miniprogram_state: 'formal',
          lang: 'zh_CN',
          data: {
            thing1: { value: input.title.slice(0, 20) },
            thing2: { value: input.content.slice(0, 20) },
          },
        }),
      });

      const result = (await response.json()) as { errcode?: number; errmsg?: string };

      if (result.errcode === 0) {
        return { status: 'SENT' };
      }

      return { status: 'FAILED', error: `${result.errcode}: ${result.errmsg}` };
    } catch (error) {
      return { status: 'FAILED', error: (error as Error).message };
    }
  }

  private async resolveOpenid(
    receiverType: ReceiverType,
    receiverId: bigint,
  ): Promise<string | null> {
    if (receiverType === 'STAFF') {
      const staff = await this.prisma.staff.findUnique({ where: { id: receiverId } });
      return staff ? staff.openid : null;
    }

    const user = await this.prisma.user.findUnique({ where: { id: receiverId } });
    return user ? user.openid : null;
  }

  private async getAccessToken(): Promise<string> {
    const now = Date.now();

    if (this.accessToken && this.accessTokenExpireAt > now) {
      return this.accessToken;
    }

    const appid = this.config.get<string>('WX_APPID');
    const secret = this.config.get<string>('WX_SECRET');

    const url =
      'https://api.weixin.qq.com/cgi-bin/token' +
      `?grant_type=client_credential&appid=${appid}&secret=${secret}`;

    const response = await fetch(url);
    const data = (await response.json()) as {
      access_token?: string;
      expires_in?: number;
      errmsg?: string;
    };

    if (!data.access_token) {
      throw new Error(`获取 access_token 失败：${data.errmsg ?? '未知错误'}`);
    }

    this.accessToken = data.access_token;
    // 提前 5 分钟过期，避免边界情况
    this.accessTokenExpireAt = now + ((data.expires_in ?? 7200) - 300) * 1000;

    return this.accessToken;
  }

  // ------------------------------------------------------------
  // 查询
  // ------------------------------------------------------------
  async list(receiverType: ReceiverType, receiverId: bigint, query: NotifyQueryDto) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;

    const where = { receiverType, receiverId };

    const [total, list, unread] = await this.prisma.$transaction([
      this.prisma.notification.count({ where }),
      this.prisma.notification.findMany({
        where,
        orderBy: { id: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.notification.count({ where: { ...where, isRead: false } }),
    ]);

    return {
      list: list.map((item) => ({
        id: item.id.toString(),
        type: item.type,
        title: item.title,
        content: item.content,
        orderId: item.orderId ? item.orderId.toString() : null,
        page: item.page,
        isRead: item.isRead,
        createdAt: item.createdAt,
      })),
      total,
      unread,
      page,
      pageSize,
    };
  }

  async unreadCount(receiverType: ReceiverType, receiverId: bigint) {
    const count = await this.prisma.notification.count({
      where: { receiverType, receiverId, isRead: false },
    });
    return { unread: count };
  }

  async markRead(receiverType: ReceiverType, receiverId: bigint, id?: string) {
    const where: any = { receiverType, receiverId, isRead: false };
    if (id) {
      where.id = BigInt(id);
    }

    const result = await this.prisma.notification.updateMany({
      where,
      data: { isRead: true, readAt: new Date() },
    });

    return { updated: result.count };
  }
}
