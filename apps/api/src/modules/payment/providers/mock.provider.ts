import { Injectable, Logger } from '@nestjs/common';
import type { PaymentProvider, PrepayOrder, PrepayResult, RefundResult } from './payment-provider.interface';

/**
 * 模拟支付通道（开发环境使用）
 *
 * 用途：在没有微信支付商户号的情况下，完整跑通"下单 → 支付 → 订单流转"链路。
 * 通过 .env 的 WX_MOCK 开关控制，接入真实商户号后自动切换。
 */
@Injectable()
export class MockPaymentProvider implements PaymentProvider {
  readonly name = 'MOCK';

  private readonly logger = new Logger(MockPaymentProvider.name);

  async prepay(order: PrepayOrder): Promise<PrepayResult> {
    this.logger.warn(`[模拟支付] 订单 ${order.orderNo} 应付 ${order.amountPayable} 分`);

    return {
      provider: 'MOCK',
      mock: true,
      message: '当前为模拟支付模式，接入微信支付商户号后自动切换为真实支付',
    };
  }

  async refund(
    outTradeNo: string,
    refundNo: string,
    amount: bigint,
    reason?: string,
  ): Promise<RefundResult> {
    this.logger.warn(`[模拟退款] 订单 ${outTradeNo} 退款 ${amount} 分（${refundNo}），原因：${reason ?? '未填写'}`);
    return { success: true, refundId: `MOCK_REFUND_${refundNo}` };
  }
}
