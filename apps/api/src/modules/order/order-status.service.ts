import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { ErrorCode, ORDER_STATUS_TEXT, OrderStatus, canTransit } from '@hc/shared';
import { BizException } from '../../common/exceptions/biz.exception';
import { Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { NotifyService } from '../notify/notify.service';
import { toDbStatus, toSharedStatus } from './order-status.util';

export type OperatorType = 'USER' | 'STAFF' | 'ADMIN' | 'SYSTEM';

export interface OperatorContext {
  operatorType: OperatorType;
  operatorId?: string;
  reason?: string;
}

/** 状态流转时一并写入的字段 */
export interface OrderTransitExtra {
  paidAt?: Date;
  acceptedAt?: Date;
  checkinAt?: Date;
  finishedAt?: Date;
  confirmedAt?: Date;
  canceledAt?: Date;
  cancelReason?: string;
  cancelBy?: string;
  staffId?: bigint | null;
  dispatchDeadline?: Date | null;
  payExpireAt?: Date | null;
  checkinImage?: string | null;
  finishImages?: never;
}

/**
 * 订单状态机：所有状态变更必须经过这里。
 * 一次流转 = 校验合法性 + 乐观锁更新 + 写状态流水。
 */
@Injectable()
export class OrderStatusService {
  private readonly logger = new Logger(OrderStatusService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifyService: NotifyService,
  ) {}

  async transit(
    orderId: bigint,
    to: OrderStatus,
    context: OperatorContext,
    extra: OrderTransitExtra = {},
    tx?: Prisma.TransactionClient,
  ) {
    const client = tx ?? this.prisma;

    const order = await client.order.findUnique({ where: { id: orderId } });
    if (!order) {
      throw new BizException(ErrorCode.ORDER_NOT_FOUND);
    }

    const currentStatus = toSharedStatus(order.status);

    if (currentStatus === to) {
      return order;
    }

    if (!canTransit(currentStatus, to)) {
      throw new BizException(
        ErrorCode.ORDER_STATE_INVALID,
        `订单当前为「${ORDER_STATUS_TEXT[currentStatus]}」，无法变更为「${ORDER_STATUS_TEXT[to]}」`,
      );
    }

    const updated = await client.order.updateMany({
      where: { id: orderId, status: toDbStatus(currentStatus), version: order.version },
      data: {
        status: toDbStatus(to),
        version: { increment: 1 },
        ...extra,
      },
    });

    if (updated.count === 0) {
      throw new BizException(ErrorCode.CONFLICT_RETRY, '订单状态已被其他操作更新，请刷新后重试');
    }

    await client.orderStatusLog.create({
      data: {
        orderId,
        fromStatus: order.status,
        toStatus: to,
        operatorType: context.operatorType,
        operatorId: context.operatorId ?? null,
        reason: context.reason ?? null,
      },
    });

    const updatedOrder = await client.order.findUnique({ where: { id: orderId } });

    // 状态变化通知（站内消息 + 微信订阅消息），失败不影响订单流转
    if (updatedOrder) {
      await this.notifyStatusChange(updatedOrder, to);
    }

    return updatedOrder;
  }

  // 按新状态给用户和保洁师分别发消息
  private async notifyStatusChange(
    order: {
      id: bigint;
      orderNo: string;
      userId: bigint;
      staffId: bigint | null;
      serviceDate: Date;
      startTime: string;
      endTime: string;
      cancelReason: string | null;
    },
    to: OrderStatus,
  ) {
    const dateStr = order.serviceDate.toISOString().slice(0, 10);
    const timeText = `${dateStr} ${order.startTime}-${order.endTime}`;

    const userMessages: Partial<Record<OrderStatus, { title: string; content: string }>> = {
      [OrderStatus.PENDING_DISPATCH]: { title: '支付成功', content: '订单已支付，正在为你匹配服务人员' },
      [OrderStatus.PENDING_ACCEPT]: { title: '已匹配服务人员', content: '已为你安排服务人员，等待接单确认' },
      [OrderStatus.PENDING_SERVICE]: { title: '服务人员已接单', content: `${timeText} 上门服务` },
      [OrderStatus.IN_SERVICE]: { title: '服务已开始', content: '服务人员已到达并开始服务' },
      [OrderStatus.PENDING_CONFIRM]: { title: '服务已完成', content: '请确认服务结果，48 小时后自动确认' },
      [OrderStatus.COMPLETED]: { title: '订单已完成', content: '感谢使用，欢迎评价本次服务' },
      [OrderStatus.RESCHEDULED]: { title: '改期成功', content: `已改期至 ${timeText}` },
      [OrderStatus.CANCELED]: {
        title: '订单已取消',
        content: `订单已取消${order.cancelReason ? `：${order.cancelReason}` : ''}`,
      },
      [OrderStatus.REFUNDED]: { title: '退款已处理', content: '退款将原路返回，请留意到账' },
      [OrderStatus.EXCEPTION]: { title: '订单异常', content: '订单出现异常，客服会尽快联系你' },
    };

    const staffMessages: Partial<Record<OrderStatus, { title: string; content: string }>> = {
      [OrderStatus.PENDING_ACCEPT]: { title: '新任务', content: `${timeText} 上门服务，请及时接单` },
      [OrderStatus.CANCELED]: { title: '订单已取消', content: `客户取消了 ${timeText} 的订单` },
      [OrderStatus.RESCHEDULED]: { title: '订单已改期', content: '客户修改了服务时间，任务已重新分配' },
    };

    try {
      const userMessage = userMessages[to];
      if (userMessage) {
        await this.notifyService.send({
          receiverType: 'USER',
          receiverId: order.userId,
          type: 'ORDER_STATUS',
          title: userMessage.title,
          content: userMessage.content,
          orderId: order.id,
          page: `/pages/order/detail?id=${order.id}`,
          templateKey: 'ORDER_STATUS',
        });
      }

      // 保洁师通知：指派给自己、或自己手里的订单被取消/改期
      const staffMessage = staffMessages[to];
      if (staffMessage && order.staffId) {
        await this.notifyService.send({
          receiverType: 'STAFF',
          receiverId: order.staffId,
          type: 'ORDER_STATUS',
          title: staffMessage.title,
          content: staffMessage.content,
          orderId: order.id,
          page: `/pages/staff/detail?orderId=${order.id}`,
          templateKey: 'DISPATCH',
        });
      }
    } catch (error) {
      this.logger.warn(`发送订单通知失败 orderNo=${order.orderNo}: ${(error as Error).message}`);
    }
  }

  /** 记录初始状态流水（创建订单时使用） */
  async logInitial(
    orderId: bigint,
    status: OrderStatus,
    context: OperatorContext,
    tx?: Prisma.TransactionClient,
  ) {
    const client = tx ?? this.prisma;
    await client.orderStatusLog.create({
      data: {
        orderId,
        fromStatus: null,
        toStatus: status,
        operatorType: context.operatorType,
        operatorId: context.operatorId ?? null,
        reason: context.reason ?? null,
      },
    });
  }
}
