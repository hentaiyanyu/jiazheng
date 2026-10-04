import { Body, Controller, HttpCode, Logger, Post } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator';
import { MockPayDto, PrepayDto } from './dto/payment.dto';
import { PaymentService } from './payment.service';

@Controller('payments')
export class PaymentController {
  private readonly logger = new Logger(PaymentController.name);

  constructor(
    private readonly paymentService: PaymentService,
    private readonly config: ConfigService,
  ) {}

  /** 重新获取支付参数 */
  @Post('prepay')
  @HttpCode(200)
  prepay(@CurrentUser() user: JwtPayload, @Body() dto: PrepayDto) {
    return this.paymentService.prepayByOrderNo(BigInt(user.sub), dto.outTradeNo);
  }

  /** 模拟支付（开发环境） */
  @Post('mock-pay')
  @HttpCode(200)
  mockPay(@CurrentUser() user: JwtPayload, @Body() dto: MockPayDto) {
    return this.paymentService.mockPay(BigInt(user.sub), dto.outTradeNo);
  }

  /**
   * 微信支付结果回调
   *
   * TODO(接入真实支付时)：验签 + 解密 + 金额比对后调用 markPaid。
   * 当前未接入真实支付，直接拒绝，避免未验签的回调影响订单状态。
   */
  @Public()
  @Post('notify')
  @HttpCode(200)
  notify(@Body() body: Record<string, unknown>) {
    const isMock = (this.config.get<string>('WX_MOCK') ?? 'true') !== 'false';

    if (isMock) {
      this.logger.warn(`模拟模式收到支付回调，已忽略：${JSON.stringify(body).slice(0, 200)}`);
      return { code: 'SUCCESS', message: '模拟模式，忽略回调' };
    }

    this.logger.error('收到真实支付回调，但验签逻辑尚未实现');
    return { code: 'FAIL', message: '支付回调验签尚未实现' };
  }
}
