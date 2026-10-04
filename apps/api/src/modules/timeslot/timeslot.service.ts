import { Injectable, Logger } from '@nestjs/common';
import {
  BOOKING_LEAD_MINUTES,
  ErrorCode,
  SLOT_END_HOUR,
  SLOT_LATE_END_HOUR,
  SLOT_LATE_MAX_HOURS,
  SLOT_START_HOUR,
  buildOccupiedTimes,
} from '@hc/shared';
import { BizException } from '../../common/exceptions/biz.exception';
import { PrismaService } from '../../prisma/prisma.service';
import { TimeSlotQueryDto } from './dto/timeslot-query.dto';

/** 时段库存：查询 + 缺省生成 */
@Injectable()
export class TimeSlotService {
  private readonly logger = new Logger(TimeSlotService.name);

  /** 默认每个时段的容量（新生成时使用，后续由运营在后台调整） */
  private readonly defaultCapacity = 4;

  constructor(private readonly prisma: PrismaService) {}

  async getSlots(query: TimeSlotQueryDto) {
    const date = this.parseDate(query.date);
    const durationMinutes = await this.resolveDuration(query.serviceId, query.skuId);
    const rows = await this.ensureSlots(date, query.districtCode);

    // 服务时长必须完整落在可服务时间窗内：
    // 普通服务最晚 20:00 结束；2 小时以内的短单可延到 21:00（支持 19:00 上门）
    const needHours = Math.max(1, Math.ceil(durationMinutes / 60));
    // 仅「正好 2 小时」的短单可延到 21:00，其余服务保持 20:00 结束
    const maxEndHour = needHours === SLOT_LATE_MAX_HOURS ? SLOT_LATE_END_HOUR : SLOT_END_HOUR;
    const lastStartHour = maxEndHour - needHours;

    // 时段按整点存储，下单需要连续占用 needHours 个时段，
    // 因此可用性必须检查整段，而不是只看起始那一个小时
    const slotMap = new Map(rows.map((row) => [row.startTime, row]));

    const slots = rows.map((row) => {
      const startHour = Number.parseInt(row.startTime.slice(0, 2), 10);
      const endTime = `${String(startHour + needHours).padStart(2, '0')}:00`;

      // 今天已经过去的时间不能预约
      if (this.isPastSlot(date, row.startTime)) {
        return {
          startTime: row.startTime,
          endTime,
          remaining: 0,
          available: false,
          reason: 'PAST',
        };
      }

      if (startHour > lastStartHour) {
        return {
          startTime: row.startTime,
          endTime,
          remaining: 0,
          available: false,
          reason: 'TOO_LATE',
        };
      }

      // 逐个小时检查：必须都存在、都开放、都有余量
      // 注意：只检查排班范围内的时段（19:00 开始的 2 小时单只占 19:00 这一格）
      let blockedReason: string | null = null;
      let minRemaining = Number.MAX_SAFE_INTEGER;

      for (const time of buildOccupiedTimes(row.startTime, needHours)) {
        const target = slotMap.get(time);

        if (!target) {
          blockedReason = 'UNAVAILABLE';
          break;
        }
        if (target.status !== 1) {
          blockedReason = 'CLOSED';
          break;
        }

        const remaining = Math.max(0, target.capacity - target.locked - target.used);
        if (remaining <= 0) {
          blockedReason = 'FULL';
          break;
        }

        minRemaining = Math.min(minRemaining, remaining);
      }

      const available = blockedReason === null;

      return {
        startTime: row.startTime,
        endTime,
        // 展示整段中最小余量，避免「显示有余量但下单失败」
        remaining: available ? minRemaining : 0,
        available,
        reason: blockedReason,
      };
    });

    const earliest = slots.find((slot) => slot.available);

    return {
      date: query.date,
      durationMinutes,
      earliestAvailable: earliest ? earliest.startTime : null,
      slots,
    };
  }

  private parseDate(dateStr: string): Date {
    const date = new Date(`${dateStr}T00:00:00.000Z`);
    if (Number.isNaN(date.getTime())) {
      throw new BizException(ErrorCode.PARAM_INVALID, '日期格式不正确');
    }
    return date;
  }

  // 距开始不足 BOOKING_LEAD_MINUTES 的时段视为不可预约（含已过去的时间）
  private isPastSlot(serviceDate: Date, startTime: string): boolean {
    const dateStr = serviceDate.toISOString().slice(0, 10);
    const startAt = new Date(`${dateStr}T${startTime}:00+08:00`);
    return startAt.getTime() - Date.now() < BOOKING_LEAD_MINUTES * 60 * 1000;
  }

  private async resolveDuration(serviceId: string, skuId?: string): Promise<number> {
    if (skuId) {
      const sku = await this.prisma.serviceSku.findFirst({
        where: { id: BigInt(skuId), status: 1, deletedAt: null },
      });
      if (!sku) {
        throw new BizException(ErrorCode.NOT_FOUND, '规格不存在或已下架');
      }
      return sku.durationMinutes;
    }

    const service = await this.prisma.service.findFirst({
      where: { id: BigInt(serviceId), status: 1, deletedAt: null },
    });
    if (!service) {
      throw new BizException(ErrorCode.NOT_FOUND, '服务不存在或已下架');
    }
    return service.durationMinutes;
  }

  /** 首次查询某天时段时自动按模板生成，避免空数据 */
  private async ensureSlots(date: Date, districtCode: string) {
    // 只取排班范围内的时段（历史数据里可能残留 20:00 的记录，直接忽略）
    const endTimeLimit = `${String(SLOT_END_HOUR).padStart(2, '0')}:00`;

    const existing = await this.prisma.timeSlot.findMany({
      where: { serviceDate: date, districtCode, startTime: { lt: endTimeLimit } },
      orderBy: { startTime: 'asc' },
    });

    // 排班表覆盖 08:00 – 19:00 的起始时段（19:00-20:00 为当天最后一个时段）
    const required: string[] = [];
    for (let hour = SLOT_START_HOUR; hour < SLOT_END_HOUR; hour++) {
      required.push(`${String(hour).padStart(2, '0')}:00`);
    }

    const existingStartTimes = new Set(existing.map((row) => row.startTime));
    const missing = required.filter((time) => !existingStartTimes.has(time));

    if (missing.length === 0) {
      return existing;
    }

    this.logger.log(
      `补齐时段库存：${date.toISOString().slice(0, 10)} / ${districtCode} / ${missing.join('、')}`,
    );

    // 历史数据可能只有到 20:00 的时段，这里补齐缺失部分（并发安全：唯一键 + skipDuplicates）
    await this.prisma.timeSlot.createMany({
      data: missing.map((startTime) => {
        const hour = Number.parseInt(startTime.slice(0, 2), 10);
        return {
          serviceDate: date,
          startTime,
          endTime: `${String(hour + 1).padStart(2, '0')}:00`,
          districtCode,
          capacity: this.defaultCapacity,
        };
      }),
      skipDuplicates: true,
    });

    return this.prisma.timeSlot.findMany({
      where: { serviceDate: date, districtCode, startTime: { lt: endTimeLimit } },
      orderBy: { startTime: 'asc' },
    });
  }
}
