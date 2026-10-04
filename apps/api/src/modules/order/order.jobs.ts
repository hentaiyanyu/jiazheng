import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { OrderService } from './order.service';

// 订单定时任务：关闭超时未支付订单 + 服务完成后超时自动确认 + 派单超时自动退款
// MVP 阶段使用进程内定时器（单实例部署足够）；
// 多实例部署时改为分布式锁或独立调度服务即可，业务方法无需改动。
@Injectable()
export class OrderJobs implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(OrderJobs.name);
  private timer?: NodeJS.Timeout;
  private running = false;

  constructor(private readonly orderService: OrderService) {}

  onModuleInit(): void {
    this.timer = setInterval(() => {
      void this.run();
    }, 60 * 1000);

    if (typeof this.timer.unref === 'function') {
      this.timer.unref();
    }

    this.logger.log('订单定时任务已启动（每分钟检查一次）');
  }

  onModuleDestroy(): void {
    if (this.timer) {
      clearInterval(this.timer);
    }
  }

  private async run(): Promise<void> {
    if (this.running) {
      return;
    }
    this.running = true;

    try {
      await this.orderService.closeExpiredOrders();
      await this.orderService.autoConfirmOrders();
      await this.orderService.refundTimeoutDispatchOrders();
    } catch (error) {
      this.logger.error(`订单定时任务执行失败：${(error as Error).message}`);
    } finally {
      this.running = false;
    }
  }
}
