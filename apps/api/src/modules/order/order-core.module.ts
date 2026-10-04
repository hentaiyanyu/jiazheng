import { Module } from '@nestjs/common';
import { NotifyModule } from '../notify/notify.module';
import { OrderStatusService } from './order-status.service';
import { SlotService } from './slot.service';

/**
 * 订单核心能力（状态机 + 时段占用），
 * 被 OrderModule 与 PaymentModule 共同依赖，独立成模块避免循环依赖。
 */
@Module({
  imports: [NotifyModule],
  providers: [OrderStatusService, SlotService],
  exports: [OrderStatusService, SlotService],
})
export class OrderCoreModule {}
