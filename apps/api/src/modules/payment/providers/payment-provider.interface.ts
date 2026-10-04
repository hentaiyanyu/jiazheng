export interface PrepayOrder {
  orderNo: string;
  amountPayable: bigint;
  description: string;
}

export interface PrepayResult {
  /** 支付渠道 */
  provider: 'MOCK' | 'WECHAT';
  /** 是否为模拟支付：小程序据此走"模拟确认"流程 */
  mock: boolean;
  timeStamp?: string;
  nonceStr?: string;
  package?: string;
  signType?: string;
  paySign?: string;
  message?: string;
}

export interface RefundResult {
  success: boolean;
  refundId?: string;
  message?: string;
}

export interface PaymentProvider {
  readonly name: string;
  prepay(order: PrepayOrder): Promise<PrepayResult>;
  refund(outTradeNo: string, refundNo: string, amount: bigint, reason?: string): Promise<RefundResult>;
}
