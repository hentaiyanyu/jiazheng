import { Injectable, Logger } from '@nestjs/common';
import { StaffStatus, type Order, type Staff } from '@prisma/client';
import { DISPATCH_STAFF_WAIT_MINUTES, ErrorCode, OrderStatus } from '@hc/shared';
import { BizException } from '../../common/exceptions/biz.exception';
import { isDispatchDeadlinePassed } from '../../common/utils/dispatch-time.util';
import { toDateOnly } from '../../common/utils/service-time.util';
import { PrismaService } from '../../prisma/prisma.service';
import { OrderStatusService } from '../order/order-status.service';
import { toDbStatus, toSharedStatus } from '../order/order-status.util';
import { SlotService } from '../order/slot.service';

interface Candidate {
  staff: Staff;
  score: number;
  todayCount: number;
}

// 派单调度：候选人筛选 + 打分 + 派发 + 超时重派
@Injectable()
export class DispatchService {
  private readonly logger = new Logger(DispatchService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly orderStatusService: OrderStatusService,
    private readonly slotService: SlotService,
  ) {}

  // 为订单自动派单（选得分最高的一位）
  async dispatchOrder(orderId: bigint, excludeStaffIds: bigint[] = []) {
    const order = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!order) {
      throw new BizException(ErrorCode.ORDER_NOT_FOUND);
    }

    if (toSharedStatus(order.status) !== OrderStatus.PENDING_DISPATCH) {
      return { dispatched: false, reason: 'NOT_PENDING_DISPATCH' };
    }

    const candidates = await this.findCandidates(order, excludeStaffIds);
    if (candidates.length === 0) {
      const reason = await this.explainNoCandidate(order, excludeStaffIds);
      this.logger.warn(`订单 ${order.orderNo} 暂无可用保洁师（原因：${reason}），等待人工派单`);
      return { dispatched: false, reason, message: this.describeReason(reason) };
    }

    const best = candidates[0];

    await this.prisma.$transaction(async (tx) => {
      await tx.dispatch.create({
        data: {
          orderId: order.id,
          staffId: best.staff.id,
          dispatchType: 'AUTO',
          status: 'PENDING',
          score: best.score,
          expireAt: new Date(Date.now() + DISPATCH_STAFF_WAIT_MINUTES * 60 * 1000),
        },
      });

      await this.orderStatusService.transit(
        order.id,
        OrderStatus.PENDING_ACCEPT,
        { operatorType: 'SYSTEM', reason: `自动派单给 ${best.staff.name}` },
        { staffId: best.staff.id },
        tx,
      );
    });

    this.logger.log(`订单 ${order.orderNo} 已派给 ${best.staff.name}（得分 ${best.score}）`);

    return {
      dispatched: true,
      staffId: best.staff.id.toString(),
      staffName: best.staff.name,
      score: best.score,
      candidateCount: candidates.length,
    };
  }

  // 候选人筛选与打分
  private async findCandidates(order: Order, excludeStaffIds: bigint[]): Promise<Candidate[]> {
    const staffs = await this.prisma.staff.findMany({
      where: {
        status: StaffStatus.ACTIVE,
        deletedAt: null,
        ...(excludeStaffIds.length > 0 ? { id: { notIn: excludeStaffIds } } : {}),
      },
    });

    const date = toDateOnly(order.serviceDate);
    const hours = Math.max(1, Math.ceil(order.durationMinutes / 60));
    const times = this.slotService.buildTimes(order.startTime, hours);
    const busyStatuses = [
      OrderStatus.PENDING_SERVICE,
      OrderStatus.IN_SERVICE,
      OrderStatus.PENDING_CONFIRM,
    ].map(toDbStatus);

    const candidates: Candidate[] = [];

    for (const staff of staffs) {
      // 1. 服务区域匹配（未配置区域视为全城可服务）
      const districts = (staff.serviceDistricts as string[] | null) ?? [];
      if (districts.length > 0 && districts.indexOf(order.districtCode) < 0) {
        continue;
      }

      // 2. 当日单量限制
      const todayCount = await this.prisma.order.count({
        where: {
          staffId: staff.id,
          serviceDate: date,
          status: { in: busyStatuses },
          deletedAt: null,
        },
      });
      if (todayCount >= staff.maxDailyOrders) {
        continue;
      }

      // 3. 时段冲突
      const conflict = await this.prisma.order.findFirst({
        where: {
          staffId: staff.id,
          serviceDate: date,
          startTime: { in: times },
          status: { in: busyStatuses },
          deletedAt: null,
        },
      });
      if (conflict) {
        continue;
      }

      candidates.push({ staff, score: this.scoreStaff(staff, todayCount), todayCount });
    }

    return candidates.sort((a, b) => b.score - a.score);
  }

  // 没找到候选人时给出可读的原因，便于运营快速定位
  private async explainNoCandidate(order: Order, excludeStaffIds: bigint[]): Promise<string> {
    const total = await this.prisma.staff.count({ where: { deletedAt: null } });
    if (total === 0) {
      return 'NO_STAFF';
    }

    const active = await this.prisma.staff.count({
      where: { status: StaffStatus.ACTIVE, deletedAt: null },
    });
    if (active === 0) {
      return 'NO_ACTIVE_STAFF';
    }

    const inDistrict = await this.prisma.staff.count({
      where: {
        status: StaffStatus.ACTIVE,
        deletedAt: null,
        ...(excludeStaffIds.length > 0 ? { id: { notIn: excludeStaffIds } } : {}),
      },
    });
    if (inDistrict === 0) {
      return 'ALL_EXCLUDED';
    }

    // 检查是否因为区域不匹配
    const allActive = await this.prisma.staff.findMany({
      where: { status: StaffStatus.ACTIVE, deletedAt: null },
      select: { serviceDistricts: true },
    });
    const districtMatched = allActive.some((staff) => {
      const districts = (staff.serviceDistricts as string[] | null) ?? [];
      return districts.length === 0 || districts.indexOf(order.districtCode) >= 0;
    });
    if (!districtMatched) {
      return 'NO_STAFF_IN_DISTRICT';
    }

    return 'ALL_BUSY_OR_CONFLICT';
  }

  private describeReason(reason: string): string {
    const map: Record<string, string> = {
      NO_STAFF: '系统里还没有保洁师，请先在后台添加',
      NO_ACTIVE_STAFF: '没有处于「正常」状态的保洁师',
      ALL_EXCLUDED: '所有可接单的保洁师都已拒绝过这一单',
      NO_STAFF_IN_DISTRICT: '没有覆盖该区域的保洁师，请调整保洁师的服务区域',
      ALL_BUSY_OR_CONFLICT: '保洁师当日单量已满或时段冲突',
    };
    return map[reason] ?? '没有可用保洁师';
  }

  // 打分：评分 40% + 接单率 25% + 准时率 20% + 工作量均衡 15%
  private scoreStaff(staff: Staff, todayCount: number): number {
    const rating = staff.ratingX10 / 50;
    const acceptRate = staff.acceptRate / 100;
    const onTimeRate = staff.onTimeRate / 100;
    const balance = Math.max(0, 1 - todayCount / Math.max(1, staff.maxDailyOrders));

    const value = 0.4 * rating + 0.25 * acceptRate + 0.2 * onTimeRate + 0.15 * balance;
    return Math.round(value * 100);
  }

  // 该订单已拒绝/超时的保洁师（重新派单时排除）
  async getExcludedStaffIds(orderId: bigint): Promise<bigint[]> {
    const rows = await this.prisma.dispatch.findMany({
      where: { orderId, status: { in: ['REJECTED', 'TIMEOUT'] } },
      select: { staffId: true },
    });
    return rows.map((row) => row.staffId);
  }

  // 处理超时未响应的派单：退回待派单并换下一位
  async handleExpiredDispatches(): Promise<number> {
    const expired = await this.prisma.dispatch.findMany({
      where: { status: 'PENDING', expireAt: { lt: new Date() } },
      take: 20,
      orderBy: { id: 'asc' },
    });

    let handled = 0;

    for (const dispatch of expired) {
      await this.prisma.dispatch.update({
        where: { id: dispatch.id },
        data: { status: 'TIMEOUT', respondedAt: new Date() },
      });

      const order = await this.prisma.order.findUnique({ where: { id: dispatch.orderId } });
      if (!order || toSharedStatus(order.status) !== OrderStatus.PENDING_ACCEPT) {
        continue;
      }

      // 已超过派单截止时间：不再换人，留给订单定时任务自动全额退款
      if (isDispatchDeadlinePassed(order.dispatchDeadline)) {
        this.logger.warn(`订单 ${order.orderNo} 已超过派单截止时间，等待自动退款`);
        continue;
      }

      try {
        await this.orderStatusService.transit(
          order.id,
          OrderStatus.PENDING_DISPATCH,
          { operatorType: 'SYSTEM', reason: '保洁师超时未响应，重新派单' },
          { staffId: null },
        );

        const excluded = await this.getExcludedStaffIds(order.id);
        await this.dispatchOrder(order.id, excluded);
        handled += 1;
      } catch (error) {
        this.logger.warn(`超时重派失败 orderNo=${order.orderNo}: ${(error as Error).message}`);
      }
    }

    return handled;
  }

  /**
   * 待派单订单的兜底重试
   *
   * 场景：首次派单时保洁师都在忙 / 都被排除，之后有人空出来。
   * 已支付的待派单订单会被周期性重试，避免一直卡住。
   * 超过派单截止时间的订单不再重试，交给自动退款任务处理。
   */
  async retryPendingOrders(): Promise<number> {
    const now = new Date();

    const list = await this.prisma.order.findMany({
      where: {
        status: toDbStatus(OrderStatus.PENDING_DISPATCH),
        paidAt: { not: null },
        deletedAt: null,
        OR: [{ dispatchDeadline: null }, { dispatchDeadline: { gt: now } }],
      },
      take: 20,
      orderBy: { id: 'asc' },
    });

    let dispatched = 0;

    for (const order of list) {
      try {
        const excluded = await this.getExcludedStaffIds(order.id);
        const result = await this.dispatchOrder(order.id, excluded);
        if (result.dispatched) {
          dispatched += 1;
        }
      } catch (error) {
        this.logger.warn(`重试派单失败 orderNo=${order.orderNo}: ${(error as Error).message}`);
      }
    }

    return dispatched;
  }
}
