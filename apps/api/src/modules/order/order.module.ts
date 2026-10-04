import { Module } from '@nestjs/common';
import { AreaModule } from '../area/area.module';
import { DispatchModule } from '../dispatch/dispatch.module';
import { PaymentModule } from '../payment/payment.module';
import { PriceModule } from '../price/price.module';
import { OrderCoreModule } from './order-core.module';
import { OrderController } from './order.controller';
import { OrderJobs } from './order.jobs';
import { OrderService } from './order.service';

@Module({
  imports: [OrderCoreModule, PriceModule, AreaModule, PaymentModule, DispatchModule],
  controllers: [OrderController],
  providers: [OrderService, OrderJobs],
  exports: [OrderService],
})
export class OrderModule {}
