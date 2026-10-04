import { Controller, Get } from '@nestjs/common';
import { Public } from '../../common/decorators/public.decorator';
import { PrismaService } from '../../prisma/prisma.service';

@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  /** 健康检查：供负载均衡与监控使用 */
  @Public()
  @Get()
  async check() {
    let db = 'up';
    try {
      await this.prisma.$queryRaw`SELECT 1`;
    } catch {
      db = 'down';
    }

    return {
      status: db === 'up' ? 'ok' : 'degraded',
      db,
      env: process.env.NODE_ENV ?? 'development',
      uptime: Math.floor(process.uptime()),
      serverTime: new Date().toISOString(),
    };
  }
}
