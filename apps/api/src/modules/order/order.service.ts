import { Injectable, Logger } from '@nestjs/common';
import type { Order } from '@prisma/client';
import {
  AUTO_CONFIRM_HOURS,
  BOOKING_LEAD_MINUTES,
  DOOR_FEE_AMOUNT,
  DOOR_FEE_WITHIN_MINUTES,
  ErrorCode,
  ORDER_PAY_TIMEOUT_MINUTES,
  OrderStatus,
} from '@hc/shared';
import { BizException } from '../../common/exceptions/biz.exception';
import { computeDispatchDeadline } from '../../common/utils/dispatch-time.util';
import { minutesUntilServiceStart, toDateOnly } from '../../common/utils/service-time.util';
import { PrismaService } from '../../prisma/prisma.service';
import { AreaService } from '../area/area.service';
import { DispatchService } from '../dispatch/dispatch.service';
import { PaymentService } from '../payment/payment.service';
import { PriceService } from '../price/price.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { CancelOrderDto, QueryOrderDto, RescheduleOrderDto } from './dto/query-order.dto';
import { OrderStatusService } from './order-status.service';
import { toDbStatus, toSharedStatus } from './order-status.util';
import { SlotService } from './slot.service';
import { toOrderVo } from './vo/order.vo';

// 允许用户取消的订单状态
const CANCELABLE_STATUSES: OrderStatus[] = [
  OrderStatus.PENDING_PAYMENT,
  OrderStatus.PENDING_DISPATCH,
  OrderStatus.PENDING_ACCEPT,
  OrderStatus.PENDING_SERVICE,
];

@Injectable()
export class OrderService {
  private readonly logger = new Logger(OrderService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly priceService: PriceService,
    private readonly areaService: AreaService,
    private readonly paymentService: PaymentService,
    private readonly dispatchService: DispatchService,
    private readonly orderStatusService: OrderStatusService,
    private readonly slotService: SlotService,
  ) {}

  // ============================================================
  // 创建订单
  // ============================================================
  async create(userId: bigint, dto: CreateOrderDto) {
    // 1. 幂等：同一 requestId 直接返回已有订单
    const existed = await this.prisma.order.findUnique({ where: { requestId: dto.requestId } });
    if (existed) {
      this.logger.warn(`重复下单请求 requestId=${dto.requestId}，返回已有订单 ${existed.orderNo}`);
      return this.buildCreateResult(existed);
    }

    // 2. 校验规格
    const sku = await this.prisma.serviceSku.findFirst({
      where: { id: BigInt(dto.skuId), serviceId: BigInt(dto.serviceId), status: 1, deletedAt: null },
      include: { service: true },
    });
    if (!sku) {
      throw new BizException(ErrorCode.NOT_FOUND, '规格不存在或已下架');
    }

    // 3. 校验地址归属
    const address = await this.prisma.address.findFirst({
      where: { id: BigInt(dto.addressId), userId, deletedAt: null },
    });
    if (!address) {
      throw new BizException(ErrorCode.NOT_FOUND, '地址不存在');
    }

    // 4. 服务范围校验
    const area = await this.areaService.check({
      districtCode: address.regionCode,
      communityId: address.communityId ? address.communityId.toString() : undefined,
    });
    if (!area.served) {
      throw new BizException(ErrorCode.ADDRESS_OUT_OF_RANGE, `当前地址暂未开通服务（${area.reason}）`);
    }

    // 5. 服务端权威计价
    const price = await this.priceService.calculate(userId, {
      serviceId: dto.serviceId,
      skuId: dto.skuId,
      addons: dto.addons,
      addressId: dto.addressId,
      serviceDate: dto.serviceDate,
      startTime: dto.startTime,
      couponId: dto.couponId,
    });

    if (dto.expectedAmount !== undefined && Number(dto.expectedAmount) !== price.amountPayable) {
      throw new BizException(ErrorCode.PRICE_CHANGED);
    }

    // 6. 占用时段
    const hours = Math.max(1, Math.ceil(price.durationMinutes / 60));
    const serviceDate = this.parseDate(dto.serviceDate);

    // 不能预约已过去或即将开始的时间（防止绕过前端直接调接口）
    if (this.isStartTooSoon(serviceDate, dto.startTime)) {
      throw new BizException(
        ErrorCode.PARAM_INVALID,
        `该时段已过或距开始不足 ${BOOKING_LEAD_MINUTES} 分钟，请选择更晚的时间`,
      );
    }

    const times = this.slotService.buildTimes(dto.startTime, hours);

    const locked = await this.slotService.lock(serviceDate, dto.startTime, hours, address.regionCode);
    if (!locked) {
      throw new BizException(ErrorCode.SLOT_FULL);
    }

    // 7. 落库
    try {
      const addonRows = await this.loadAddonRows(dto);
      const orderNo = this.buildOrderNo();
      const payExpireAt = new Date(Date.now() + ORDER_PAY_TIMEOUT_MINUTES * 60 * 1000);

      const created = await this.prisma.$transaction(async (tx) => {
        const order = await tx.order.create({
          data: {
            orderNo,
            requestId: dto.requestId,
            userId,
            status: toDbStatus(OrderStatus.PENDING_PAYMENT),
            serviceId: sku.serviceId,
            skuId: sku.id,
            serviceDate,
            startTime: dto.startTime,
            endTime: this.buildEndTime(dto.startTime, hours),
            durationMinutes: price.durationMinutes,
            districtCode: address.regionCode,
            addressSnapshot: {
              id: address.id.toString(),
              contactName: address.contactName,
              contactPhone: address.contactPhone,
              province: address.province,
              city: address.city,
              district: address.district,
              detail: address.detail,
              floor: address.floor,
              hasElevator: address.hasElevator,
              lng: Number(address.lng),
              lat: Number(address.lat),
            } as never,
            serviceSnapshot: {
              serviceId: sku.serviceId.toString(),
              name: sku.service.name,
              skuId: sku.id.toString(),
              skuName: sku.name,
              priceType: sku.service.priceType,
              addons: addonRows.map((row) => ({
                id: row.id.toString(),
                name: row.name,
                price: Number(row.price),
              })),
            } as never,
            amountService: BigInt(price.amountService),
            amountAddon: BigInt(price.amountAddon),
            amountExtra: BigInt(price.amountExtra),
            amountDiscount: BigInt(price.amountDiscount),
            amountPayable: BigInt(price.amountPayable),
            couponId: dto.couponId ? BigInt(dto.couponId) : null,
            remark: dto.remark ?? null,
            payExpireAt,
          },
        });

        await tx.orderItem.create({
          data: {
            orderId: order.id,
            itemType: 'SERVICE',
            itemId: sku.id,
            name: `${sku.service.name} · ${sku.name}`,
            price: sku.price,
            quantity: 1,
            durationMinutes: sku.durationMinutes,
          },
        });

        for (const addon of addonRows) {
          await tx.orderItem.create({
            data: {
              orderId: order.id,
              itemType: 'ADDON',
              itemId: addon.id,
              name: addon.name,
              price: addon.price,
              quantity: this.findAddonQuantity(dto, addon.id),
              durationMinutes: addon.durationMinutes,
            },
          });
        }

        await this.orderStatusService.logInitial(
          order.id,
          OrderStatus.PENDING_PAYMENT,
          { operatorType: 'USER', operatorId: userId.toString(), reason: '创建订单' },
          tx,
        );

        await tx.payment.create({
          data: {
            orderId: order.id,
            outTradeNo: order.orderNo,
            amount: order.amountPayable,
            channel: this.paymentService.isMockMode() ? 'MOCK' : 'WECHAT',
            status: 'PENDING',
          },
        });

        // 核销优惠券
        if (dto.couponId) {
          await tx.userCoupon.updateMany({
            where: { id: BigInt(dto.couponId), userId, status: 1 },
            data: { status: 2, orderId: order.id, usedAt: new Date() },
          });
        }

        return order;
      });

      return this.buildCreateResult(created);
    } catch (error) {
      // 落库失败必须把时段还回去
      await this.slotService.release(serviceDate, times, address.regionCode);
      throw error;
    }
  }

  // ============================================================
  // 查询
  // ============================================================
  async list(userId: bigint, query: QueryOrderDto) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 10;

    // 使用 any 以便动态拼接筛选条件（Prisma 的 WhereInput 类型不支持逐字段赋值）
    const where: any = { userId, deletedAt: null };
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

    // 批量补充服务人员信息
    const staffIds = Array.from(
      new Set(list.filter((order) => order.staffId).map((order) => order.staffId!.toString())),
    );
    const staffRows = staffIds.length
      ? await this.prisma.staff.findMany({ where: { id: { in: staffIds.map((id) => BigInt(id)) } } })
      : [];
    const staffMap = new Map(staffRows.map((staff) => [staff.id.toString(), staff]));

    return {
      list: list.map((order) => {
        const row = order.staffId ? staffMap.get(order.staffId.toString()) : null;
        return toOrderVo(order, {
          staff: row
            ? { id: row.id.toString(), name: row.name, rating: Number((row.ratingX10 / 10).toFixed(1)) }
            : null,
        });
      }),
      total,
      page,
      pageSize,
    };
  }

  async detail(userId: bigint, orderId: bigint) {
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, userId, deletedAt: null },
    });
    if (!order) {
      throw new BizException(ErrorCode.ORDER_NOT_FOUND);
    }

    // 附带服务人员信息（派单成功后展示）
    let staff: { id: string; name: string; rating: number } | null = null;
    if (order.staffId) {
      const row = await this.prisma.staff.findUnique({ where: { id: order.staffId } });
      if (row) {
        staff = {
          id: row.id.toString(),
          name: row.name,
          rating: Number((row.ratingX10 / 10).toFixed(1)),
        };
      }
    }

    // 附带评价信息（已完成订单可评价 / 展示评价内容）
    const review = await this.prisma.review.findFirst({
      where: { orderId: order.id, deletedAt: null },
    });

    return Object.assign(toOrderVo(order, { staff, reviewed: Boolean(review) }), {
      review: review
        ? {
            id: review.id.toString(),
            score: review.score,
            tags: (review.tags as string[] | null) ?? [],
            content: review.content,
            images: (review.images as string[] | null) ?? [],
            isAnonymous: review.isAnonymous,
            reply: review.reply,
            createdAt: review.createdAt,
          }
        : null,
    });
  }

  // 再来一单：返回下单页所需参数
  async repeat(userId: bigint, orderId: bigint) {
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, userId, deletedAt: null },
      include: { items: true },
    });
    if (!order) {
      throw new BizException(ErrorCode.ORDER_NOT_FOUND);
    }

    const addonItems = order.items.filter((item) => item.itemType === 'ADDON');

    return {
      serviceId: order.serviceId.toString(),
      skuId: order.skuId.toString(),
      addonIds: addonItems.map((item) => item.itemId.toString()),
    };
  }

  // ============================================================
  // 取消订单
  // ============================================================
  async cancel(userId: bigint, orderId: bigint, dto: CancelOrderDto) {
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, userId, deletedAt: null },
    });
    if (!order) {
      throw new BizException(ErrorCode.ORDER_NOT_FOUND);
    }

    const currentStatus = toSharedStatus(order.status);
    if (CANCELABLE_STATUSES.indexOf(currentStatus) < 0) {
      throw new BizException(ErrorCode.ORDER_STATE_INVALID);
    }

    const paid = Boolean(order.paidAt);
    const decision = paid
      ? this.calcRefundDecision(order)
      : { amount: 0n, requiresApproval: false, rule: '未支付，无需退款' };
    const refundAmount = decision.amount;
    const now = new Date();

    await this.prisma.$transaction(async (tx) => {
      await this.orderStatusService.transit(
        order.id,
        OrderStatus.CANCELED,
        { operatorType: 'USER', operatorId: userId.toString(), reason: dto.reason ?? '用户取消' },
        { canceledAt: now, cancelReason: dto.reason ?? '用户取消', cancelBy: 'USER' },
        tx,
      );

      if (paid) {
        await tx.refund.create({
          data: {
            orderId: order.id,
            refundNo: `RF${Date.now()}${Math.floor(Math.random() * 1000)}`,
            amount: refundAmount,
            // 把规则一并写入原因，方便客服审批时判断金额是否合理
            reason: `${dto.reason ?? '用户取消'}（${decision.rule}）`,
            // 系统按规则直接退款，无需人工审批
            status: 'SUCCESS',
            operator: `USER:${userId}`,
            refundedAt: now,
          },
        });
      }

      await tx.payment.updateMany({
        where: { orderId: order.id, status: 'PENDING' },
        data: { status: 'CLOSED' },
      });

      // 退回已核销的优惠券
      if (order.couponId) {
        await tx.userCoupon.updateMany({
          where: { id: order.couponId, orderId: order.id, status: 2 },
          data: { status: 1, orderId: null, usedAt: null },
        });
      }
    });

    const hours = Math.max(1, Math.ceil(order.durationMinutes / 60));
    const times = this.slotService.buildTimes(order.startTime, hours);
    const date = toDateOnly(order.serviceDate);

    if (paid) {
      await this.slotService.releaseUsed(date, times, order.districtCode);
    } else {
      await this.slotService.release(date, times, order.districtCode);
    }

    return {
      canceled: true,
      refundAmount: Number(refundAmount),
      refunded: paid && refundAmount > 0n,
      requiresApproval: false,
      refundRule: decision.rule,
    };
  }

  // 用户确认完工
  async confirm(userId: bigint, orderId: bigint) {
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, userId, deletedAt: null },
    });
    if (!order) {
      throw new BizException(ErrorCode.ORDER_NOT_FOUND);
    }

    await this.orderStatusService.transit(
      order.id,
      OrderStatus.COMPLETED,
      { operatorType: 'USER', operatorId: userId.toString(), reason: '用户确认完工' },
      { confirmedAt: new Date() },
    );

    return { completed: true };
  }

  // 改期：占用新时段 → 状态转为已改期 → 回到待派单重新匹配保洁师
  async reschedule(userId: bigint, orderId: bigint, dto: RescheduleOrderDto) {
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, userId, deletedAt: null },
    });
    if (!order) {
      throw new BizException(ErrorCode.ORDER_NOT_FOUND);
    }

    const currentStatus = toSharedStatus(order.status);
    const reschedulable: OrderStatus[] = [
      OrderStatus.PENDING_DISPATCH,
      OrderStatus.PENDING_ACCEPT,
      OrderStatus.PENDING_SERVICE,
    ];
    if (reschedulable.indexOf(currentStatus) < 0) {
      throw new BizException(ErrorCode.ORDER_STATE_INVALID, '当前状态不支持改期');
    }

    // 距开工不足 4 小时不允许自助改期（避免保洁师已经出门）
    if (this.hoursUntilStart(order) < 4) {
      throw new BizException(
        ErrorCode.ORDER_STATE_INVALID,
        '距服务开始不足 4 小时，无法自助改期，请联系客服',
      );
    }

    const oldDateStr = order.serviceDate.toISOString().slice(0, 10);
    if (dto.serviceDate === oldDateStr && dto.startTime === order.startTime) {
      throw new BizException(ErrorCode.PARAM_INVALID, '新时间与当前时间相同，无需改期');
    }

    const hours = Math.max(1, Math.ceil(order.durationMinutes / 60));
    const newDate = this.parseDate(dto.serviceDate);

    if (this.isStartTooSoon(newDate, dto.startTime)) {
      throw new BizException(
        ErrorCode.PARAM_INVALID,
        `该时段已过或距开始不足 ${BOOKING_LEAD_MINUTES} 分钟，请选择更晚的时间`,
      );
    }

    const newTimes = this.slotService.buildTimes(dto.startTime, hours);
    const oldDate = toDateOnly(order.serviceDate);
    const oldTimes = this.slotService.buildTimes(order.startTime, hours);

    // 先占新时段：失败直接返回，原订单不受影响
    const occupied = await this.slotService.occupy(newDate, newTimes, order.districtCode);
    if (!occupied) {
      throw new BizException(ErrorCode.SLOT_FULL);
    }

    try {
      await this.prisma.$transaction(async (tx) => {
        // 未响应的派单记录作废
        await tx.dispatch.updateMany({
          where: { orderId: order.id, status: 'PENDING' },
          data: { status: 'CANCELED', respondedAt: new Date(), reason: '用户改期' },
        });

        await tx.order.update({
          where: { id: order.id },
          data: {
            serviceDate: newDate,
            startTime: dto.startTime,
            endTime: this.buildEndTime(dto.startTime, hours),
          },
        });

        await this.orderStatusService.transit(
          order.id,
          OrderStatus.RESCHEDULED,
          {
            operatorType: 'USER',
            operatorId: userId.toString(),
            reason: `改期至 ${dto.serviceDate} ${dto.startTime}`,
          },
          {},
          tx,
        );

        await this.orderStatusService.transit(
          order.id,
          OrderStatus.PENDING_DISPATCH,
          { operatorType: 'SYSTEM', reason: '改期后重新派单' },
          {
            staffId: null,
            dispatchDeadline: computeDispatchDeadline(new Date(), newDate, dto.startTime),
          },
          tx,
        );
      });
    } catch (error) {
      await this.slotService.releaseUsed(newDate, newTimes, order.districtCode);
      throw error;
    }

    // 释放原时段
    if (order.paidAt) {
      await this.slotService.releaseUsed(oldDate, oldTimes, order.districtCode);
    } else {
      await this.slotService.release(oldDate, oldTimes, order.districtCode);
    }

    // 立即尝试重新派单（失败也会被兜底任务在 30 秒内重试）
    try {
      await this.dispatchService.dispatchOrder(orderId);
    } catch (error) {
      this.logger.warn(`改期后自动派单失败 orderNo=${order.orderNo}: ${(error as Error).message}`);
    }

    return {
      rescheduled: true,
      serviceDate: dto.serviceDate,
      startTime: dto.startTime,
      endTime: this.buildEndTime(dto.startTime, hours),
    };
  }

  // ============================================================
  // 定时任务使用
  // ============================================================
  async closeExpiredOrders(): Promise<number> {
    const expired = await this.prisma.order.findMany({
      where: {
        status: toDbStatus(OrderStatus.PENDING_PAYMENT),
        payExpireAt: { lt: new Date() },
        deletedAt: null,
      },
      take: 50,
      orderBy: { id: 'asc' },
    });

    let closed = 0;

    for (const order of expired) {
      try {
        await this.orderStatusService.transit(
          order.id,
          OrderStatus.CANCELED,
          { operatorType: 'SYSTEM', reason: '支付超时自动关闭' },
          { canceledAt: new Date(), cancelReason: '超时未支付', cancelBy: 'SYSTEM' },
        );

        await this.paymentService.closePayment(order.id);

        const hours = Math.max(1, Math.ceil(order.durationMinutes / 60));
        await this.slotService.release(
          toDateOnly(order.serviceDate),
          this.slotService.buildTimes(order.startTime, hours),
          order.districtCode,
        );

        closed += 1;
      } catch (error) {
        this.logger.warn(`关闭超时订单失败 orderNo=${order.orderNo}: ${(error as Error).message}`);
      }
    }

    if (closed > 0) {
      this.logger.log(`已关闭 ${closed} 张超时未支付订单`);
    }

    return closed;
  }

  async autoConfirmOrders(): Promise<number> {
    const threshold = new Date(Date.now() - AUTO_CONFIRM_HOURS * 60 * 60 * 1000);

    const list = await this.prisma.order.findMany({
      where: {
        status: toDbStatus(OrderStatus.PENDING_CONFIRM),
        finishedAt: { lt: threshold },
        deletedAt: null,
      },
      take: 50,
    });

    let confirmed = 0;

    for (const order of list) {
      try {
        await this.orderStatusService.transit(
          order.id,
          OrderStatus.COMPLETED,
          { operatorType: 'SYSTEM', reason: '超时自动确认' },
          { confirmedAt: new Date() },
        );
        confirmed += 1;
      } catch (error) {
        this.logger.warn(`自动确认失败 orderNo=${order.orderNo}: ${(error as Error).message}`);
      }
    }

    return confirmed;
  }

  /**
   * 派单超时兜底：支付后超过 dispatchDeadline 仍无人接单，自动全额退款。
   *
   * 覆盖「一直没匹配到保洁师」和「派出去的人全部超时/拒单」两种情况：
   * 只要订单还停在待派单/待接单，就全额退款、释放时段并退回优惠券，不需要客服介入。
   */
  async refundTimeoutDispatchOrders(): Promise<number> {
    const now = new Date();

    const candidates = await this.prisma.order.findMany({
      where: {
        status: {
          in: [toDbStatus(OrderStatus.PENDING_DISPATCH), toDbStatus(OrderStatus.PENDING_ACCEPT)],
        },
        paidAt: { not: null },
        deletedAt: null,
        // 没有截止时间的老订单也捞出来，下面按支付时间兜底计算
        OR: [{ dispatchDeadline: { lte: now } }, { dispatchDeadline: null }],
      },
      take: 50,
      orderBy: { id: 'asc' },
    });

    let refunded = 0;

    for (const order of candidates) {
      const deadline =
        order.dispatchDeadline ??
        computeDispatchDeadline(
          order.paidAt ?? order.createdAt,
          order.serviceDate,
          order.startTime,
        );

      if (deadline.getTime() > now.getTime()) {
        continue;
      }

      try {
        if (await this.refundDispatchTimeout(order)) {
          refunded += 1;
        }
      } catch (error) {
        this.logger.warn(
          `派单超时自动退款失败 orderNo=${order.orderNo}: ${(error as Error).message}`,
        );
      }
    }

    if (refunded > 0) {
      this.logger.log(`派单超时无人接单，已自动全额退款 ${refunded} 单`);
    }

    return refunded;
  }

  // 单笔派单超时退款：作废未响应的派单 + 状态流转 + 退款流水 + 释放时段
  // 返回是否真的产生了退款（已退款过则跳过，保证重复执行不会退两次钱）
  private async refundDispatchTimeout(order: Order): Promise<boolean> {
    const now = new Date();
    const refundNo = `RF${Date.now()}${Math.floor(Math.random() * 1000)}`;
    let refunded = false;

    await this.prisma.$transaction(async (tx) => {
      // 幂等保护：多实例部署或任务重跑时，已经退过款的订单不再重复退款
      const current = await tx.order.findUnique({ where: { id: order.id } });
      if (!current || toSharedStatus(current.status) === OrderStatus.REFUNDED) {
        return;
      }

      // 还在等待响应的派单记录一并作废，避免保洁师端留下过期任务
      await tx.dispatch.updateMany({
        where: { orderId: order.id, status: 'PENDING' },
        data: { status: 'CANCELED', respondedAt: now, reason: '派单超时自动退款' },
      });

      await this.orderStatusService.transit(
        order.id,
        OrderStatus.REFUNDED,
        { operatorType: 'SYSTEM', reason: '派单超时无人接单，自动全额退款' },
        { cancelReason: '超时无人接单', cancelBy: 'SYSTEM' },
        tx,
      );

      await tx.refund.create({
        data: {
          orderId: order.id,
          refundNo,
          amount: order.amountPayable,
          reason: '派单超时无人接单，自动全额退款',
          // 平台原因，系统直接全额退回，无需人工审批
          status: 'SUCCESS',
          operator: 'SYSTEM',
          refundedAt: now,
        },
      });
      refunded = true;

      // 退回已核销的优惠券：用户没有过错，券不该被消耗
      if (order.couponId) {
        await tx.userCoupon.updateMany({
          where: { id: order.couponId, orderId: order.id, status: 2 },
          data: { status: 1, orderId: null, usedAt: null },
        });
      }
    });

    if (!refunded) {
      return false;
    }

    const hours = Math.max(1, Math.ceil(order.durationMinutes / 60));
    await this.slotService.releaseUsed(
      toDateOnly(order.serviceDate),
      this.slotService.buildTimes(order.startTime, hours),
      order.districtCode,
    );

    return true;
  }

  // ============================================================
  // 内部工具
  // ============================================================
  private async buildCreateResult(order: {
    id: bigint;
    orderNo: string;
    amountPayable: bigint;
    payExpireAt: Date | null;
    serviceSnapshot: unknown;
  }) {
    const payParams = await this.paymentService.prepay({
      orderNo: order.orderNo,
      amountPayable: order.amountPayable,
      serviceSnapshot: order.serviceSnapshot,
    });

    return {
      orderId: order.id.toString(),
      orderNo: order.orderNo,
      amountPayable: Number(order.amountPayable),
      expireAt: order.payExpireAt,
      payParams,
    };
  }

  private async loadAddonRows(dto: CreateOrderDto) {
    const items = dto.addons ?? [];
    if (items.length === 0) {
      return [];
    }

    const ids = items.map((item) => BigInt(item.addonId));
    return this.prisma.serviceAddon.findMany({
      where: { id: { in: ids }, status: 1, deletedAt: null },
    });
  }

  private findAddonQuantity(dto: CreateOrderDto, addonId: bigint): number {
    const item = (dto.addons ?? []).find((addon) => BigInt(addon.addonId) === addonId);
    return item ? item.quantity : 1;
  }

  private parseDate(dateStr: string): Date {
    return new Date(`${dateStr}T00:00:00.000Z`);
  }

  private buildEndTime(startTime: string, hours: number): string {
    const startHour = Number.parseInt(startTime.slice(0, 2), 10);
    return `${String(startHour + hours).padStart(2, '0')}:00`;
  }

  private buildOrderNo(): string {
    const now = new Date();
    const pad = (value: number) => String(value).padStart(2, '0');
    const stamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
    const random = String(Math.floor(Math.random() * 10000)).padStart(4, '0');
    return `HC${stamp}${random}`;
  }

  /**
   * 退款规则
   *
   * 1. 距服务开始超过 60 分钟：全额退款
   * 2. 距服务开始不足 60 分钟（含已到时间）：扣除 30 元上门费后退款
   * 3. 系统直接按规则退款，无需人工审批
   */
  private calcRefundDecision(order: {
    serviceDate: Date;
    startTime: string;
    amountPayable: bigint;
  }): { amount: bigint; requiresApproval: boolean; rule: string } {
    const minutesUntilStart = this.minutesUntilStart(order);
    const payable = order.amountPayable;

    // 距开始不足 60 分钟：扣除上门费
    if (minutesUntilStart <= DOOR_FEE_WITHIN_MINUTES) {
      const fee = BigInt(DOOR_FEE_AMOUNT);
      const amount = payable > fee ? payable - fee : 0n;
      return {
        amount,
        requiresApproval: false,
        rule: `距服务开始不足 ${DOOR_FEE_WITHIN_MINUTES} 分钟，扣除上门费 ${DOOR_FEE_AMOUNT / 100} 元`,
      };
    }

    // 距开始超过 60 分钟：全额退款
    return {
      amount: payable,
      requiresApproval: false,
      rule: '全额退款',
    };
  }

  // 距服务开始的剩余小时数
  private hoursUntilStart(order: { serviceDate: Date; startTime: string }): number {
    return this.minutesUntilStart(order) / 60;
  }

  // 距服务开始的剩余分钟数
  private minutesUntilStart(order: { serviceDate: Date; startTime: string }): number {
    return minutesUntilServiceStart(order.serviceDate, order.startTime);
  }

  // 距开始时间是否过近
  private isStartTooSoon(serviceDate: Date, startTime: string): boolean {
    return minutesUntilServiceStart(serviceDate, startTime) < BOOKING_LEAD_MINUTES;
  }
}
