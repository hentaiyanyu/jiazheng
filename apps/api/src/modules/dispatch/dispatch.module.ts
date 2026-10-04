import { Module } from '@nestjs/common';
import { OrderCoreModule } from '../order/order-core.module';
import { DispatchJobs } from './dispatch.jobs';
import { DispatchService } from './dispatch.service';

@Module({
  imports: [OrderCoreModule],
  providers: [DispatchService, DispatchJobs],
  exports: [DispatchService],
})
export class DispatchModule {}
