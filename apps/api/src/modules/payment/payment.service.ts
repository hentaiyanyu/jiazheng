import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DISPATCH_DEFAULT_TIMEOUT_MINUTES, ErrorCode, OrderStatus } from '@hc/shared';
import { BizException } from '../../common/exceptions/biz.exception';
import { PrismaService } from '../../prisma/prisma.service';
import { DispatchService } from '../dispatch/dispatch.service';
import { OrderStatusService } from '../order/order-status.service';
import { SlotService } from '../order/slot.service';
import { MockPaymentProvider } from './providers/mock.provider';
import { WechatPaymentProvider } from './providers/wechat.provider';
import type { PrepayResult } from './providers/payment-provider.interface';

@Injectable()
export class PaymentService {
  private readonly logger = new Logger(PaymentService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly orderStatusService: OrderStatusService,
    private readonly slotService: SlotService,
    private readonly dispatchService: DispatchService,
    private readonly mockProvider: MockPaymentProvider,
    private readonly wechatProvider: WechatPaymentProvider,
  ) {}

  /** 未配置商户号或显式开启 mock 时使用模拟通道 */
  isMockMode(): boolean {
    const mock = (this.config.get<string>('WX_MOCK') ?? 'true') !== 'false';
    const mchid = this.config.get<string>('WXPAY_MCHID');
    return mock || !mchid;
  }

  /** 下单支付参数 */
  async prepay(order: {
    orderNo: string;
    amountPayable: bigint;
    serviceSnapshot?: unknown;
  }): Promise<PrepayResult> {
    const snapshot = (order.serviceSnapshot ?? {}) as { name?: string };

    const payload = {
      orderNo: order.orderNo,
      amountPayable: order.amountPayable,
      description: `家政服务-${snapshot.name ?? '清洁服务'}`,
    };

    return this.isMockMode()
      ? this.mockProvider.prepay(payload)
      : this.wechatProvider.prepay(payload);
  }

  /** 按订单号重新获取支付参数（订单列表"去支付"） */
  async prepayByOrderNo(userId: bigint, outTradeNo: string): Promise<PrepayResult> {
    const order = await this.prisma.order.findFirst({
      where: { orderNo: outTradeNo, userId, deletedAt: null },
    });

    if (!order) {
      throw new BizException(ErrorCode.ORDER_NOT_FOUND);
    }
    const currentStatus: string = order.status;
    if (currentStatus !== OrderStatus.PENDING_PAYMENT) {
      throw new BizException(ErrorCode.ORDER_STATE_INVALID, '该订单当前无需支付');
    }

    return this.prepay(order);
  }

  /** 模拟支付（仅开发环境可用） */
  async mockPay(userId: bigint, outTradeNo: string) {
    if (!this.isMockMode()) {
      throw new BizException(ErrorCode.PAYMENT_ERROR, '当前不是模拟支付模式');
    }

    const order = await this.prisma.order.findFirst({ where: { orderNo: outTradeNo, userId } });
    if (!order) {
      throw new BizException(ErrorCode.ORDER_NOT_FOUND);
    }

    this.logger.warn(`[模拟支付] 用户 ${userId} 支付订单 ${outTradeNo}`);
    return this.markPaid(outTradeNo, `MOCK${Date.now()}`, { mock: true });
  }

  /**
   * 标记支付成功（真实回调与模拟支付共用）
   *
   * 幂等：payment.status 已是 PAID 或订单已流转时直接返回成功。
   */
  async markPaid(outTradeNo: string, transactionId: string, raw?: unknown) {
    const payment = await this.prisma.payment.findUnique({
      where: { outTradeNo },
      include: { order: true },
    });

    if (!payment) {
      throw new BizException(ErrorCode.NOT_FOUND, '支付单不存在');
    }

    if (payment.status === 'PAID') {
      return { ok: true, duplicated: true };
    }

    const order = payment.order;

    const currentStatus: string = order.status;
    if (currentStatus !== OrderStatus.PENDING_PAYMENT) {
      this.logger.warn(`订单 ${outTradeNo} 状态为 ${order.status}，跳过支付处理`);
      return { ok: true, duplicated: true };
    }

    const now = new Date();
    const dispatchDeadline = new Date(now.getTime() + DISPATCH_DEFAULT_TIMEOUT_MINUTES * 60 * 1000);

    await this.prisma.$transaction(async (tx) => {
      await tx.payment.update({
        where: { id: payment.id },
        data: {
          status: 'PAID',
          transactionId,
          paidAt: now,
          rawCallback: (raw ?? null) as never,
        },
      });

      await this.orderStatusService.transit(
        order.id,
        OrderStatus.PENDING_DISPATCH,
        { operatorType: 'SYSTEM', reason: '支付成功' },
        { paidAt: now, dispatchDeadline },
        tx,
      );
    });

    const hours = Math.max(1, Math.ceil(order.durationMinutes / 60));
    await this.slotService.confirm(
      this.toDateOnly(order.serviceDate),
      this.slotService.buildTimes(order.startTime, hours),
      order.districtCode,
    );

    this.logger.log(`订单 ${outTradeNo} 支付成功，已进入待派单`);

    // 支付成功后立即触发自动派单
    try {
      await this.dispatchService.dispatchOrder(order.id);
    } catch (error) {
      this.logger.warn(`自动派单失败 orderNo=${outTradeNo}: ${(error as Error).message}`);
    }

    return { ok: true };
  }

  /** 发起退款（当前走模拟通道，接入真实支付后替换 provider 即可） */
  async refund(orderId: bigint, amount: bigint, reason: string | undefined, operator: string) {
    const order = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!order) {
      throw new BizException(ErrorCode.ORDER_NOT_FOUND);
    }

    const refundNo = `RF${Date.now()}${Math.floor(Math.random() * 1000)}`;

    const result = await this.mockProvider.refund(order.orderNo, refundNo, amount, reason);

    return this.prisma.refund.create({
      data: {
        orderId,
        refundNo,
        amount,
        reason: reason ?? '用户取消',
        status: result.success ? 'SUCCESS' : 'FAILED',
        operator,
        refundedAt: result.success ? new Date() : null,
      },
    });
  }

  /** 关闭未支付的支付单 */
  async closePayment(orderId: bigint) {
    await this.prisma.payment.updateMany({
      where: { orderId, status: 'PENDING' },
      data: { status: 'CLOSED' },
    });
  }

  /** DATE 列统一按 UTC 零点处理 */
  private toDateOnly(date: Date): Date {
    return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  }
}
