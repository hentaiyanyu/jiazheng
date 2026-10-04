import { Injectable, Logger } from '@nestjs/common';
import { buildOccupiedTimes } from '@hc/shared';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * 时段占用服务
 *
 * 说明：MVP 阶段以 MySQL 的原子 UPDATE 作为唯一权威（单条 SQL 内完成
 * "校验余量 + 扣减"，天然并发安全），因此不引入 Redis 与数据库之间的
 * 一致性维护成本。后续如需更高并发，可在这一层前加 Redis 预占。
 */
@Injectable()
export class SlotService {
  private readonly logger = new Logger(SlotService.name);

  constructor(private readonly prisma: PrismaService) {}

  // 把 "09:00" + 3 小时 展开为 ["09:00","10:00","11:00"]（超出排班范围的小时不占用）
  buildTimes(startTime: string, hours: number): string[] {
    return buildOccupiedTimes(startTime, hours);
  }

  /**
   * 预占连续时段。任意一段不足则整体失败，并回滚已占用的部分。
   */
  async lock(date: Date, startTime: string, hours: number, districtCode: string): Promise<boolean> {
    const times = this.buildTimes(startTime, hours);
    const locked: string[] = [];

    for (const time of times) {
      const affected = await this.prisma.$executeRaw`
        UPDATE time_slot
        SET locked = locked + 1, version = version + 1, updated_at = NOW(3)
        WHERE service_date = ${date}
          AND start_time = ${time}
          AND district_code = ${districtCode}
          AND status = 1
          AND capacity - locked - used >= 1
      `;

      if (Number(affected) === 0) {
        if (locked.length > 0) {
          await this.release(date, locked, districtCode);
        }
        return false;
      }

      locked.push(time);
    }

    return true;
  }

  /** 释放预占（取消订单、支付超时、下单失败回滚） */
  async release(date: Date, times: string[], districtCode: string): Promise<void> {
    for (const time of times) {
      await this.prisma.$executeRaw`
        UPDATE time_slot
        SET locked = GREATEST(locked - 1, 0), version = version + 1, updated_at = NOW(3)
        WHERE service_date = ${date} AND start_time = ${time} AND district_code = ${districtCode}
      `;
    }
  }

  /** 支付成功：预占转为正式占用 */
  async confirm(date: Date, times: string[], districtCode: string): Promise<void> {
    for (const time of times) {
      await this.prisma.$executeRaw`
        UPDATE time_slot
        SET locked = GREATEST(locked - 1, 0), used = used + 1, version = version + 1, updated_at = NOW(3)
        WHERE service_date = ${date} AND start_time = ${time} AND district_code = ${districtCode}
      `;
    }
  }

  /**
   * 直接占用时段（改期使用）
   *
   * 与 lock 的区别：直接计入 used（订单已支付），任意一段不足则整体回滚。
   */
  async occupy(date: Date, times: string[], districtCode: string): Promise<boolean> {
    const occupied: string[] = [];

    for (const time of times) {
      const affected = await this.prisma.$executeRaw`
        UPDATE time_slot
        SET used = used + 1, version = version + 1, updated_at = NOW(3)
        WHERE service_date = ${date}
          AND start_time = ${time}
          AND district_code = ${districtCode}
          AND status = 1
          AND capacity - locked - used >= 1
      `;

      if (Number(affected) === 0) {
        if (occupied.length > 0) {
          await this.releaseUsed(date, occupied, districtCode);
        }
        return false;
      }

      occupied.push(time);
    }

    return true;
  }

  /** 订单取消且已支付：释放正式占用 */
  async releaseUsed(date: Date, times: string[], districtCode: string): Promise<void> {
    for (const time of times) {
      await this.prisma.$executeRaw`
        UPDATE time_slot
        SET used = GREATEST(used - 1, 0), version = version + 1, updated_at = NOW(3)
        WHERE service_date = ${date} AND start_time = ${time} AND district_code = ${districtCode}
      `;
    }
  }
}
