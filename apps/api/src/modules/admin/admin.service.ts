import { Injectable, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { StaffStatus } from '@prisma/client';
import { ErrorCode, OrderStatus, PrincipalType } from '@hc/shared';
import { BizException } from '../../common/exceptions/biz.exception';
import { verifyPassword } from '../../common/utils/password.util';
import { PrismaService } from '../../prisma/prisma.service';
import { DispatchService } from '../dispatch/dispatch.service';
import { OrderStatusService } from '../order/order-status.service';
import { toDbStatus, toSharedStatus } from '../order/order-status.util';
import { SlotService } from '../order/slot.service';
import { toOrderVo } from '../order/vo/order.vo';
import {
  AdminDispatchDto,
  AdminCreateStaffDto,
  AdminOrderQueryDto,
  AdminRefundQueryDto,
  AdminUpdateStaffDto,
} from './dto/admin.dto';

@Injectable()
export class AdminService {
  private readonly logger = new Logger(AdminService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly dispatchService: DispatchService,
    private readonly orderStatusService: OrderStatusService,
    private readonly slotService: SlotService,
  ) {}

  // ============================================================
  // 登录
  // ============================================================
  async login(username: string, password: string) {
    const admin = await this.prisma.adminUser.findFirst({
      where: { username, deletedAt: null },
    });

    if (!admin || !verifyPassword(password, admin.passwordHash)) {
      throw new BizException(ErrorCode.UNAUTHORIZED, '用户名或密码错误');
    }

    if (admin.status !== 1) {
      throw new BizException(ErrorCode.FORBIDDEN, '账号已停用');
    }

    await this.prisma.adminUser.update({
      where: { id: admin.id },
      data: { lastLoginAt: new Date() },
    });

    const token = await this.jwtService.signAsync({
      sub: admin.id.toString(),
      type: PrincipalType.ADMIN,
      adminId: admin.id.toString(),
      adminRole: admin.role,
    });

    return {
      token,
      adminInfo: {
        id: admin.id.toString(),
        username: admin.username,
        name: admin.name,
        role: admin.role,
      },
    };
  }

  async getProfile(adminId: bigint) {
    const admin = await this.prisma.adminUser.findFirst({
      where: { id: adminId, deletedAt: null },
    });
    if (!admin) {
      throw new BizException(ErrorCode.NOT_FOUND, '账号不存在');
    }

    return {
      id: admin.id.toString(),
      username: admin.username,
      name: admin.name,
      role: admin.role,
      lastLoginAt: admin.lastLoginAt,
    };
  }

  // ============================================================
  // 订单管理
  // ============================================================
  async listOrders(query: AdminOrderQueryDto) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;

    const where: any = { deletedAt: null };
    if (query.status) {
      where.status = toDbStatus(query.status as OrderStatus);
    }
    if (query.keyword) {
      where.orderNo = { contains: query.keyword };
    }

    const [total, list] = await this.prisma.$transaction([
      this.prisma.order.count({ where }),
      this.prisma.order.findMany({
        where,
        orderBy: { id: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    const userIds = Array.from(new Set(list.map((order) => order.userId.toString())));
    const users = userIds.length
      ? await this.prisma.user.findMany({ where: { id: { in: userIds.map((id) => BigInt(id)) } } })
      : [];
    const userMap = new Map(users.map((user) => [user.id.toString(), user]));

    const staffIds = Array.from(
      new Set(list.filter((order) => order.staffId).map((order) => order.staffId!.toString())),
    );
    const staffRows = staffIds.length
      ? await this.prisma.staff.findMany({ where: { id: { in: staffIds.map((id) => BigInt(id)) } } })
      : [];
    const staffMap = new Map(staffRows.map((staff) => [staff.id.toString(), staff]));

    return {
      list: list.map((order) => {
        const vo = toOrderVo(order);
        const user = userMap.get(order.userId.toString());
        return Object.assign(vo, {
          staffId: order.staffId ? order.staffId.toString() : null,
          staffName: order.staffId
            ? staffMap.get(order.staffId.toString())?.name ?? null
            : null,
          user: user
            ? { id: user.id.toString(), nickname: user.nickname, phone: user.phone }
            : null,
        });
      }),
      total,
      page,
      pageSize,
    };
  }

  async getOrderDetail(orderId: bigint) {
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, deletedAt: null },
      include: {
        logs: { orderBy: { id: 'asc' } },
        payments: true,
        dispatches: { include: { staff: true }, orderBy: { id: 'asc' } },
      },
    });

    if (!order) {
      throw new BizException(ErrorCode.ORDER_NOT_FOUND);
    }

    const user = await this.prisma.user.findUnique({ where: { id: order.userId } });

    return Object.assign(toOrderVo(order), {
      user: user
        ? { id: user.id.toString(), nickname: user.nickname, phone: user.phone }
        : null,
      logs: order.logs.map((log) => ({
        id: log.id.toString(),
        fromStatus: log.fromStatus,
        toStatus: log.toStatus,
        operatorType: log.operatorType,
        operatorId: log.operatorId,
        reason: log.reason,
        createdAt: log.createdAt,
      })),
      payments: order.payments.map((payment) => ({
        id: payment.id.toString(),
        outTradeNo: payment.outTradeNo,
        amount: Number(payment.amount),
        channel: payment.channel,
        status: payment.status,
        paidAt: payment.paidAt,
      })),
      dispatches: order.dispatches.map((dispatch) => ({
        id: dispatch.id.toString(),
        staffId: dispatch.staffId.toString(),
        staffName: dispatch.staff.name,
        status: dispatch.status,
        score: dispatch.score,
        reason: dispatch.reason,
        createdAt: dispatch.createdAt,
      })),
    });
  }

  // 人工派单：指定保洁师或让系统按得分选择
  async dispatchOrder(adminId: bigint, orderId: bigint, dto: AdminDispatchDto) {
    const order = await this.prisma.order.findFirst({ where: { id: orderId, deletedAt: null } });
    if (!order) {
      throw new BizException(ErrorCode.ORDER_NOT_FOUND);
    }

    if (toSharedStatus(order.status) !== OrderStatus.PENDING_DISPATCH) {
      throw new BizException(ErrorCode.ORDER_STATE_INVALID, '只有待派单的订单可以人工派单');
    }

    let result;

    if (dto.staffId) {
      const staff = await this.prisma.staff.findFirst({
        where: { id: BigInt(dto.staffId), deletedAt: null },
      });
      if (!staff) {
        throw new BizException(ErrorCode.NOT_FOUND, '保洁师不存在');
      }
      if (staff.status !== StaffStatus.ACTIVE) {
        throw new BizException(ErrorCode.STAFF_UNAVAILABLE, '该保洁师当前不可接单');
      }

      await this.prisma.$transaction(async (tx) => {
        await tx.dispatch.create({
          data: {
            orderId: order.id,
            staffId: staff.id,
            dispatchType: 'MANUAL',
            status: 'PENDING',
            score: 0,
            expireAt: new Date(Date.now() + 30 * 60 * 1000),
          },
        });

        await this.orderStatusService.transit(
          order.id,
          OrderStatus.PENDING_ACCEPT,
          { operatorType: 'ADMIN', operatorId: adminId.toString(), reason: `人工派单给 ${staff.name}` },
          { staffId: staff.id },
          tx,
        );
      });

      result = { dispatched: true, staffId: staff.id.toString(), staffName: staff.name };
    } else {
      const excluded = await this.dispatchService.getExcludedStaffIds(order.id);
      result = await this.dispatchService.dispatchOrder(order.id, excluded);
    }

    await this.recordAudit(adminId, 'order', 'DISPATCH', order.orderNo, result);

    return result;
  }

  // 强制取消（平台原因）：可选是否全额退款
  async cancelOrder(adminId: bigint, orderId: bigint, reason: string, withRefund: boolean) {
    const order = await this.prisma.order.findFirst({ where: { id: orderId, deletedAt: null } });
    if (!order) {
      throw new BizException(ErrorCode.ORDER_NOT_FOUND);
    }

    const currentStatus = toSharedStatus(order.status);
    const cancelable: OrderStatus[] = [
      OrderStatus.PENDING_PAYMENT,
      OrderStatus.PENDING_DISPATCH,
      OrderStatus.PENDING_ACCEPT,
      OrderStatus.PENDING_SERVICE,
    ];
    if (cancelable.indexOf(currentStatus) < 0) {
      throw new BizException(ErrorCode.ORDER_STATE_INVALID, '当前状态不支持取消');
    }

    const paid = Boolean(order.paidAt);
    const now = new Date();
    let refundNo: string | null = null;

    await this.prisma.$transaction(async (tx) => {
      await this.orderStatusService.transit(
        order.id,
        OrderStatus.CANCELED,
        { operatorType: 'ADMIN', operatorId: adminId.toString(), reason },
        { canceledAt: now, cancelReason: reason, cancelBy: 'ADMIN' },
        tx,
      );

      if (paid && withRefund) {
        refundNo = `RF${Date.now()}${Math.floor(Math.random() * 1000)}`;
        await tx.refund.create({
          data: {
            orderId: order.id,
            refundNo,
            amount: order.amountPayable,
            reason,
            // 平台原因取消：立即全额退款
            status: 'SUCCESS',
            operator: `ADMIN:${adminId}`,
            refundedAt: now,
          },
        });
      }

      await tx.payment.updateMany({
        where: { orderId: order.id, status: 'PENDING' },
        data: { status: 'CLOSED' },
      });
    });

    const hours = Math.max(1, Math.ceil(order.durationMinutes / 60));
    const times = this.slotService.buildTimes(order.startTime, hours);
    const date = new Date(
      Date.UTC(
        order.serviceDate.getUTCFullYear(),
        order.serviceDate.getUTCMonth(),
        order.serviceDate.getUTCDate(),
      ),
    );

    if (paid) {
      await this.slotService.releaseUsed(date, times, order.districtCode);
    } else {
      await this.slotService.release(date, times, order.districtCode);
    }

    await this.recordAudit(adminId, 'order', 'FORCE_CANCEL', order.orderNo, { reason, refundNo });

    return { canceled: true, refundNo, refundAmount: paid && withRefund ? Number(order.amountPayable) : 0 };
  }

  // ============================================================
  // 保洁师与退款
  // ============================================================
  async listStaff() {
    const list = await this.prisma.staff.findMany({
      where: { deletedAt: null },
      orderBy: { id: 'asc' },
    });

    return list.map((staff) => ({
      id: staff.id.toString(),
      name: staff.name,
      phone: staff.phone,
      level: staff.level,
      rating: Number((staff.ratingX10 / 10).toFixed(1)),
      orderCount: staff.orderCount,
      acceptRate: staff.acceptRate,
      onTimeRate: staff.onTimeRate,
      maxDailyOrders: staff.maxDailyOrders,
      settlementRate: staff.settlementRate,
      skillTags: (staff.skillTags as string[] | null) ?? [],
      serviceDistricts: (staff.serviceDistricts as string[] | null) ?? [],
      status: staff.status,
    }));
  }

  // 新增保洁师（默认待审核，审核通过后才能接单）
  async createStaff(adminId: bigint, dto: AdminCreateStaffDto) {
    const existed = await this.prisma.staff.findFirst({ where: { openid: dto.openid } });
    if (existed) {
      throw new BizException(ErrorCode.CONFLICT_RETRY, '该登录标识已存在，请更换');
    }

    const staff = await this.prisma.staff.create({
      data: {
        name: dto.name,
        phone: dto.phone,
        openid: dto.openid,
        skillTags: (dto.skillTags ?? []) as never,
        serviceDistricts: (dto.serviceDistricts ?? []) as never,
        maxDailyOrders: dto.maxDailyOrders ?? 4,
        settlementRate: dto.settlementRate ?? 70,
        status: StaffStatus.PENDING,
      },
    });

    await this.recordAudit(adminId, 'staff', 'CREATE', staff.id.toString(), { name: staff.name });

    return { id: staff.id.toString(), status: staff.status };
  }

  // 编辑保洁师资料（服务区域、技能标签、分成等）
  async updateStaff(adminId: bigint, staffId: bigint, dto: AdminUpdateStaffDto) {
    const staff = await this.prisma.staff.findFirst({
      where: { id: staffId, deletedAt: null },
    });
    if (!staff) {
      throw new BizException(ErrorCode.NOT_FOUND, '保洁师不存在');
    }

    const updated = await this.prisma.staff.update({
      where: { id: staffId },
      data: {
        ...(dto.name === undefined ? {} : { name: dto.name }),
        ...(dto.phone === undefined ? {} : { phone: dto.phone }),
        ...(dto.skillTags === undefined ? {} : { skillTags: dto.skillTags as never }),
        ...(dto.serviceDistricts === undefined
          ? {}
          : { serviceDistricts: dto.serviceDistricts as never }),
        ...(dto.maxDailyOrders === undefined ? {} : { maxDailyOrders: dto.maxDailyOrders }),
        ...(dto.settlementRate === undefined ? {} : { settlementRate: dto.settlementRate }),
      },
    });

    await this.recordAudit(adminId, 'staff', 'UPDATE', updated.id.toString(), dto);

    return { id: updated.id.toString(), updated: true };
  }

  // 审核 / 启用 / 暂停 / 封禁
  async updateStaffStatus(adminId: bigint, staffId: bigint, status: string, reason?: string) {
    const allowed = ['PENDING', 'ACTIVE', 'PAUSED', 'BANNED'];
    if (allowed.indexOf(status) < 0) {
      throw new BizException(ErrorCode.PARAM_INVALID, '状态值不合法');
    }

    const staff = await this.prisma.staff.findFirst({
      where: { id: staffId, deletedAt: null },
    });
    if (!staff) {
      throw new BizException(ErrorCode.NOT_FOUND, '保洁师不存在');
    }

    const updated = await this.prisma.staff.update({
      where: { id: staffId },
      data: { status: status as never },
    });

    await this.recordAudit(adminId, 'staff', `STATUS_${status}`, updated.id.toString(), {
      from: staff.status,
      to: status,
      reason,
    });

    return { id: updated.id.toString(), status: updated.status };
  }

  // 服务区域选项（已开通的区县）
  async listRegions() {
    const list = await this.prisma.region.findMany({
      where: { level: 3, status: 1, deletedAt: null },
      orderBy: { code: 'asc' },
    });

    return list.map((region) => ({
      code: region.code,
      name: region.name,
      isServed: region.isServed,
    }));
  }

  async listRefunds(query: AdminRefundQueryDto) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;

    const where: any = {};
    if (query.status) {
      where.status = query.status;
    }

    const [total, list] = await this.prisma.$transaction([
      this.prisma.refund.count({ where }),
      this.prisma.refund.findMany({
        where,
        orderBy: { id: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    const orderIds = list.map((refund) => refund.orderId);
    const orders = orderIds.length
      ? await this.prisma.order.findMany({ where: { id: { in: orderIds } } })
      : [];
    const orderMap = new Map(orders.map((order) => [order.id.toString(), order]));

    return {
      list: list.map((refund) => {
        const order = orderMap.get(refund.orderId.toString());
        return {
          id: refund.id.toString(),
          refundNo: refund.refundNo,
          orderId: refund.orderId.toString(),
          orderNo: order ? order.orderNo : null,
          amount: Number(refund.amount),
          reason: refund.reason,
          status: refund.status,
          operator: refund.operator,
          refundedAt: refund.refundedAt,
          createdAt: refund.createdAt,
        };
      }),
      total,
      page,
      pageSize,
    };
  }

  async approveRefund(adminId: bigint, refundId: bigint, amount?: number) {
    const refund = await this.prisma.refund.findUnique({ where: { id: refundId } });
    if (!refund) {
      throw new BizException(ErrorCode.NOT_FOUND, '退款单不存在');
    }
    if (refund.status !== 'PENDING') {
      throw new BizException(ErrorCode.CONFLICT_RETRY, '该退款单已处理');
    }

    const finalAmount = amount === undefined ? refund.amount : BigInt(amount);

    const updated = await this.prisma.refund.update({
      where: { id: refundId },
      data: {
        status: 'SUCCESS',
        amount: finalAmount,
        refundedAt: new Date(),
        operator: `ADMIN:${adminId}`,
      },
    });

    await this.recordAudit(adminId, 'refund', 'APPROVE', refund.refundNo, {
      amount: Number(finalAmount),
      originalAmount: Number(refund.amount),
    });

    return { approved: true, refundNo: updated.refundNo, amount: Number(updated.amount) };
  }

  // ============================================================
  // 数据看板
  // ============================================================
  async dashboard() {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const sevenDaysAgo = new Date(todayStart);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);

    const [
      todayOrders,
      todayPaid,
      pendingDispatch,
      serving,
      pendingRefunds,
      activeStaff,
      totalUsers,
      gmvAgg,
      weekOrderRows,
      statusGroups,
      staffRows,
      todayStaffGroups,
    ] = await Promise.all([
      this.prisma.order.count({ where: { createdAt: { gte: todayStart }, deletedAt: null } }),
      this.prisma.order.count({ where: { paidAt: { gte: todayStart }, deletedAt: null } }),
      this.prisma.order.count({
        where: { status: toDbStatus(OrderStatus.PENDING_DISPATCH), deletedAt: null },
      }),
      this.prisma.order.count({
        where: {
          status: {
            in: [
              toDbStatus(OrderStatus.PENDING_SERVICE),
              toDbStatus(OrderStatus.IN_SERVICE),
            ],
          },
          deletedAt: null,
        },
      }),
      this.prisma.refund.count({ where: { status: 'PENDING' } }),
      this.prisma.staff.count({ where: { status: StaffStatus.ACTIVE, deletedAt: null } }),
      this.prisma.user.count({ where: { deletedAt: null } }),
      this.prisma.order.aggregate({
        _sum: { amountPayable: true },
        where: { paidAt: { gte: todayStart }, deletedAt: null },
      }),
      // 最近 7 天的订单（一次取回后在内存里按天聚合，避免多次查询）
      this.prisma.order.findMany({
        where: { createdAt: { gte: sevenDaysAgo }, deletedAt: null },
        select: { createdAt: true, paidAt: true, amountPayable: true },
      }),
      // 订单状态分布
      this.prisma.order.groupBy({
        by: ['status'],
        _count: { _all: true },
        where: { deletedAt: null },
      }),
      // 保洁师效能（按累计单量排序）
      this.prisma.staff.findMany({
        where: { deletedAt: null },
        orderBy: [{ orderCount: 'desc' }, { id: 'asc' }],
        take: 20,
        select: {
          id: true,
          name: true,
          status: true,
          orderCount: true,
          ratingX10: true,
          acceptRate: true,
          onTimeRate: true,
        },
      }),
      // 今日每位保洁师完成的单量
      this.prisma.order.groupBy({
        by: ['staffId'],
        _count: { _all: true },
        where: {
          staffId: { not: null },
          status: toDbStatus(OrderStatus.COMPLETED),
          createdAt: { gte: todayStart },
          deletedAt: null,
        },
      }),
    ]);

    // 最近 7 天趋势
    const dayKeys: string[] = [];
    for (let offset = 6; offset >= 0; offset -= 1) {
      const day = new Date(todayStart);
      day.setDate(day.getDate() - offset);
      dayKeys.push(
        `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`,
      );
    }

    const trendMap = new Map<string, { orderCount: number; paidCount: number; gmv: bigint }>();
    for (const key of dayKeys) {
      trendMap.set(key, { orderCount: 0, paidCount: 0, gmv: 0n });
    }

    for (const row of weekOrderRows) {
      const created = row.createdAt;
      const key = `${created.getFullYear()}-${String(created.getMonth() + 1).padStart(2, '0')}-${String(created.getDate()).padStart(2, '0')}`;
      const bucket = trendMap.get(key);
      if (!bucket) {
        continue;
      }

      bucket.orderCount += 1;
      if (row.paidAt) {
        bucket.paidCount += 1;
        bucket.gmv += row.amountPayable;
      }
    }

    const trend = dayKeys.map((key) => {
      const bucket = trendMap.get(key)!;
      return {
        date: key.slice(5).replace('-', '/'),
        orderCount: bucket.orderCount,
        paidCount: bucket.paidCount,
        gmv: Number(bucket.gmv),
      };
    });

    // 状态分布
    const statusDistribution = statusGroups
      .map((group) => ({
        status: group.status as string,
        count: group._count._all,
      }))
      .sort((a, b) => b.count - a.count);

    // 保洁师效能
    const todayByStaff = new Map<string, number>();
    for (const group of todayStaffGroups) {
      if (group.staffId !== null) {
        todayByStaff.set(group.staffId.toString(), group._count._all);
      }
    }

    const staffPerformance = staffRows.map((staff) => ({
      id: staff.id.toString(),
      name: staff.name,
      status: staff.status,
      orderCount: staff.orderCount,
      todayCount: todayByStaff.get(staff.id.toString()) ?? 0,
      rating: Number((staff.ratingX10 / 10).toFixed(1)),
      acceptRate: staff.acceptRate,
      onTimeRate: staff.onTimeRate,
    }));

    return {
      today: {
        orderCount: todayOrders,
        paidCount: todayPaid,
        gmv: Number(gmvAgg._sum.amountPayable ?? 0n),
      },
      pending: {
        dispatch: pendingDispatch,
        serving,
        refunds: pendingRefunds,
      },
      resource: {
        activeStaff,
        totalUsers,
      },
      trend,
      statusDistribution,
      staffPerformance,
    };
  }

  // ============================================================
  // 审计
  // ============================================================
  private async recordAudit(
    adminId: bigint,
    module: string,
    action: string,
    targetId: string,
    detail: unknown,
  ) {
    try {
      await this.prisma.auditLog.create({
        data: {
          adminId,
          module,
          action,
          targetId,
          detail: (detail ?? null) as never,
        },
      });
    } catch (error) {
      this.logger.warn(`写审计日志失败：${(error as Error).message}`);
    }
  }
}
