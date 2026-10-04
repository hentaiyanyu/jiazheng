import { Module } from '@nestjs/common';
import { DispatchModule } from '../dispatch/dispatch.module';
import { OrderCoreModule } from '../order/order-core.module';
import { PaymentController } from './payment.controller';
import { PaymentService } from './payment.service';
import { MockPaymentProvider } from './providers/mock.provider';
import { WechatPaymentProvider } from './providers/wechat.provider';

@Module({
  imports: [OrderCoreModule, DispatchModule],
  controllers: [PaymentController],
  providers: [PaymentService, MockPaymentProvider, WechatPaymentProvider],
  exports: [PaymentService],
})
export class PaymentModule {}
