import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ErrorCode } from '@hc/shared';
import { BizException } from '../../../common/exceptions/biz.exception';
import type { PaymentProvider, PrepayOrder, PrepayResult, RefundResult } from './payment-provider.interface';

/**
 * 微信支付通道
 *
 * 待接入步骤（拿到商户号后）：
 *   1. .env 配置 WXPAY_MCHID / WXPAY_SERIAL_NO / WXPAY_PRIVATE_KEY / WXPAY_API_V3_KEY / WXPAY_NOTIFY_URL
 *   2. 引入微信支付 SDK 或自行实现 v3 签名请求
 *   3. 实现 JSAPI 统一下单、回调验签解密、申请退款
 *   4. 把 WX_MOCK 置为 false
 */
@Injectable()
export class WechatPaymentProvider implements PaymentProvider {
  readonly name = 'WECHAT';

  private readonly logger = new Logger(WechatPaymentProvider.name);

  constructor(private readonly config: ConfigService) {}

  async prepay(order: PrepayOrder): Promise<PrepayResult> {
    this.logger.error(`微信支付未配置，无法为订单 ${order.orderNo} 下单`);
    throw new BizException(
      ErrorCode.PAYMENT_ERROR,
      '微信支付尚未接入：请配置 WXPAY_MCHID 等参数，或保持 WX_MOCK=true 使用模拟支付',
    );
  }

  async refund(outTradeNo: string): Promise<RefundResult> {
    this.logger.error(`微信退款未配置，订单 ${outTradeNo}`);
    throw new BizException(ErrorCode.PAYMENT_ERROR, '微信退款尚未接入');
  }
}
