import { Module } from '@nestjs/common';
import { DispatchModule } from '../dispatch/dispatch.module';
import { OrderCoreModule } from '../order/order-core.module';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';

@Module({
  imports: [OrderCoreModule, DispatchModule],
  controllers: [AdminController],
  providers: [AdminService],
  exports: [AdminService],
})
export class AdminModule {}
