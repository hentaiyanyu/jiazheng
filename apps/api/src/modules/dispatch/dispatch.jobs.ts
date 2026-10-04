import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { DispatchService } from './dispatch.service';

// 每 30 秒检查一次超时未响应的派单，自动换下一位保洁师
@Injectable()
export class DispatchJobs implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(DispatchJobs.name);
  private timer?: NodeJS.Timeout;
  private running = false;

  constructor(private readonly dispatchService: DispatchService) {}

  onModuleInit(): void {
    this.timer = setInterval(() => {
      void this.run();
    }, 30 * 1000);

    if (typeof this.timer.unref === 'function') {
      this.timer.unref();
    }
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
      await this.dispatchService.handleExpiredDispatches();
      await this.dispatchService.retryPendingOrders();
    } catch (error) {
      this.logger.error(`派单超时检查失败：${(error as Error).message}`);
    } finally {
      this.running = false;
    }
  }
}
