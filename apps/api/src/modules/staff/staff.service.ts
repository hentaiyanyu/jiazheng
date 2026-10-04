import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { StaffStatus } from '@prisma/client';
import {
  CHECKIN_MAX_DISTANCE_METERS,
  ErrorCode,
  OrderStatus,
  PrincipalType,
} from '@hc/shared';
import { BizException } from '../../common/exceptions/biz.exception';
import { distanceInMeters } from '../../common/utils/geo.util';
import { PrismaService } from '../../prisma/prisma.service';
import { WechatService } from '../auth/wechat.service';
import { DispatchService } from '../dispatch/dispatch.service';
import { OrderStatusService } from '../order/order-status.service';
import { toDbStatus, toSharedStatus } from '../order/order-status.util';
import { toOrderVo } from '../order/vo/order.vo';
import { StaffCheckinDto, StaffFinishDto } from './dto/staff.dto';
import { toStaffVo } from './vo/staff.vo';

@Injectable()
export class StaffService {
  private readonly logger = new Logger(StaffService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
    private readonly wechat: WechatService,
    private readonly orderStatusService: OrderStatusService,
    private readonly dispatchService: DispatchService,
  ) {}

  // 保洁师登录：微信 code -> openid -> 匹配已开通的保洁师账号
  async login(code: string) {
    const session = await this.wechat.code2session(code);

    const staff = await this.prisma.staff.findFirst({
      where: { openid: session.openid, deletedAt: null },
    });

    if (!staff) {
      throw new BizException(ErrorCode.FORBIDDEN, '未找到保洁师账号，请联系平台开通');
    }
    if (staff.status === StaffStatus.BANNED) {
      throw new BizException(ErrorCode.FORBIDDEN, '账号已被封禁');
    }

    const token = await this.jwtService.signAsync({
      sub: staff.id.toString(),
      type: PrincipalType.STAFF,
      staffId: staff.id.toString(),
    });

    this.logger.log(`保洁师登录：${staff.name}`);

    return { token, staffInfo: toStaffVo(staff) };
  }

  async findById(staffId: bigint) {
    const staff = await this.prisma.staff.findFirst({ where: { id: staffId, deletedAt: null } });
    if (!staff) {
      throw new BizException(ErrorCode.NOT_FOUND, '保洁师不存在');
    }
    return staff;
  }

  async getProfile(staffId: bigint) {
    return toStaffVo(await this.findById(staffId));
  }

  // 任务列表：待接单 / 服务中 / 已完成
  async listTasks(staffId: bigint, tab?: string) {
    const pending = toDbStatus(OrderStatus.PENDING_ACCEPT);
    const serving = [
      toDbStatus(OrderStatus.PENDING_SERVICE),
      toDbStatus(OrderStatus.IN_SERVICE),
    ];
    const finished = [
      toDbStatus(OrderStatus.PENDING_CONFIRM),
      toDbStatus(OrderStatus.COMPLETED),
    ];

    let statusFilter: unknown;
    if (tab === 'FINISHED') {
      statusFilter = { in: finished };
    } else if (tab === 'SERVING') {
      statusFilter = { in: serving };
    } else if (tab === 'PENDING') {
      statusFilter = pending;
    } else {
      statusFilter = { in: [pending, ...serving] };
    }

    const list = await this.prisma.order.findMany({
      where: { staffId, status: statusFilter as never, deletedAt: null },
      orderBy: [{ serviceDate: 'asc' }, { startTime: 'asc' }],
      take: 50,
    });

    return list.map((order) => toOrderVo(order, { role: 'STAFF' }));
  }

  private async findTask(staffId: bigint, orderId: bigint) {
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, staffId, deletedAt: null },
    });
    if (!order) {
      throw new BizException(ErrorCode.ORDER_NOT_FOUND, '订单不存在或未派给你');
    }
    return order;
  }

  // 保洁师查看单个任务详情（含状态时间线与预计收入）
  async getTaskDetail(staffId: bigint, orderId: bigint) {
    const order = await this.findTask(staffId, orderId);
    const staff = await this.findById(staffId);

    const logs = await this.prisma.orderStatusLog.findMany({
      where: { orderId },
      orderBy: { id: 'asc' },
    });

    const estimatedIncome = (order.amountPayable * BigInt(staff.settlementRate)) / 100n;

    return Object.assign(toOrderVo(order, { role: 'STAFF' }), {
      settlementRate: staff.settlementRate,
      estimatedIncome: Number(estimatedIncome),
      timeline: logs.map((log) => ({
        fromStatus: log.fromStatus,
        toStatus: log.toStatus,
        operatorType: log.operatorType,
        reason: log.reason,
        createdAt: log.createdAt,
      })),
    });
  }

  // 接单
  async accept(staffId: bigint, orderId: bigint) {
    const order = await this.findTask(staffId, orderId);

    if (toSharedStatus(order.status) !== OrderStatus.PENDING_ACCEPT) {
      throw new BizException(ErrorCode.ORDER_STATE_INVALID);
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.dispatch.updateMany({
        where: { orderId, staffId, status: 'PENDING' },
        data: { status: 'ACCEPTED', respondedAt: new Date() },
      });

      await this.orderStatusService.transit(
        orderId,
        OrderStatus.PENDING_SERVICE,
        { operatorType: 'STAFF', operatorId: staffId.toString(), reason: '保洁师接单' },
        { acceptedAt: new Date() },
        tx,
      );
    });

    return { accepted: true };
  }

  // 拒单：退回待派单并自动换下一位
  async reject(staffId: bigint, orderId: bigint, reason: string) {
    const order = await this.findTask(staffId, orderId);

    if (toSharedStatus(order.status) !== OrderStatus.PENDING_ACCEPT) {
      throw new BizException(ErrorCode.ORDER_STATE_INVALID);
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.dispatch.updateMany({
        where: { orderId, staffId, status: 'PENDING' },
        data: { status: 'REJECTED', respondedAt: new Date(), reason },
      });

      await this.orderStatusService.transit(
        orderId,
        OrderStatus.PENDING_DISPATCH,
        { operatorType: 'STAFF', operatorId: staffId.toString(), reason: `拒单：${reason}` },
        { staffId: null },
        tx,
      );
    });

    // 排除已拒单的保洁师后重新派单
    const excluded = await this.dispatchService.getExcludedStaffIds(orderId);
    const result = await this.dispatchService.dispatchOrder(orderId, excluded);

    return { rejected: true, redispatch: result };
  }

  // 到店拍照打卡：校验距离 + 留存打卡照片
  async checkin(staffId: bigint, orderId: bigint, dto: StaffCheckinDto) {
    const order = await this.findTask(staffId, orderId);

    if (toSharedStatus(order.status) !== OrderStatus.PENDING_SERVICE) {
      throw new BizException(ErrorCode.ORDER_STATE_INVALID);
    }

    const snapshot = (order.addressSnapshot ?? {}) as { lng?: number; lat?: number };
    if (snapshot.lng && snapshot.lat) {
      const distance = distanceInMeters(dto.lat, dto.lng, snapshot.lat, snapshot.lng);
      if (distance > CHECKIN_MAX_DISTANCE_METERS) {
        throw new BizException(
          ErrorCode.CHECKIN_TOO_FAR,
          `距离服务地址约 ${distance} 米，需在 ${CHECKIN_MAX_DISTANCE_METERS} 米内签到`,
        );
      }
    } else {
      this.logger.warn(`订单 ${order.orderNo} 地址快照缺少坐标，跳过签到距离校验`);
    }

    if (!dto.image) {
      throw new BizException(ErrorCode.PARAM_INVALID, '请先拍照再打卡');
    }

    await this.orderStatusService.transit(
      orderId,
      OrderStatus.IN_SERVICE,
      {
        operatorType: 'STAFF',
        operatorId: staffId.toString(),
        reason: '到店拍照打卡',
      },
      { checkinAt: new Date(), checkinImage: dto.image },
    );

    return { checkedIn: true, image: dto.image };
  }

  // 完工上报
  async finish(staffId: bigint, orderId: bigint, dto: StaffFinishDto) {
    const order = await this.findTask(staffId, orderId);

    if (toSharedStatus(order.status) !== OrderStatus.IN_SERVICE) {
      throw new BizException(ErrorCode.ORDER_STATE_INVALID);
    }

    const images = dto.images ?? [];
    const imageCount = images.length;

    if (imageCount === 0) {
      throw new BizException(ErrorCode.PARAM_INVALID, '请至少上传一张完工照片');
    }

    await this.orderStatusService.transit(
      orderId,
      OrderStatus.PENDING_CONFIRM,
      {
        operatorType: 'STAFF',
        operatorId: staffId.toString(),
        reason: `完工上报（${imageCount} 张照片）${dto.remark ? '，备注：' + dto.remark : ''}`,
      },
      { finishedAt: new Date(), finishImages: images as never },
    );

    // 累计完成单量
    await this.prisma.staff.update({
      where: { id: staffId },
      data: { orderCount: { increment: 1 } },
    });

    return { finished: true, imageCount };
  }

  // 收入概览
  async income(staffId: bigint) {
    const staff = await this.findById(staffId);

    const orders = await this.prisma.order.findMany({
      where: { staffId, status: toDbStatus(OrderStatus.COMPLETED), deletedAt: null },
      select: { amountPayable: true },
    });

    const totalAmount = orders.reduce((sum, order) => sum + order.amountPayable, 0n);
    const settledAmount = (totalAmount * BigInt(staff.settlementRate)) / 100n;

    return {
      orderCount: orders.length,
      totalAmount: Number(totalAmount),
      settledAmount: Number(settledAmount),
      settlementRate: staff.settlementRate,
    };
  }
}
