import { OrderStatus } from '@hc/shared';
import { OrderService } from './order.service';

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;

/** 两天后的服务日期（避免用例受真实时间影响） */
function futureServiceDate(): Date {
  const date = new Date(Date.now() + 2 * 24 * HOUR);
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function buildOrder(overrides: Record<string, unknown> = {}) {
  return {
    id: 1n,
    orderNo: 'HC20261005000001',
    status: OrderStatus.PENDING_DISPATCH,
    serviceDate: futureServiceDate(),
    startTime: '20:00',
    durationMinutes: 120,
    districtCode: '310115',
    amountPayable: 19900n,
    couponId: null,
    paidAt: new Date(Date.now() - 2 * HOUR),
    dispatchDeadline: new Date(Date.now() - MINUTE),
    deletedAt: null,
    createdAt: new Date(Date.now() - 3 * HOUR),
    ...overrides,
  };
}

function setup(orders: unknown[]) {
  const tx = {
    dispatch: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
    refund: { create: jest.fn().mockResolvedValue({}) },
    userCoupon: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
  };

  const prisma = {
    order: { findMany: jest.fn().mockResolvedValue(orders) },
    $transaction: jest.fn((fn: (client: unknown) => Promise<unknown>) => fn(tx)),
  };

  const orderStatusService = { transit: jest.fn().mockResolvedValue(undefined) };
  const slotService = {
    buildTimes: jest.fn().mockReturnValue(['20:00', '21:00']),
    releaseUsed: jest.fn().mockResolvedValue(undefined),
  };

  const service = new OrderService(
    prisma as never,
    {} as never, // priceService
    {} as never, // areaService
    {} as never, // paymentService
    {} as never, // dispatchService
    orderStatusService as never,
    slotService as never,
  );

  return { service, prisma, tx, orderStatusService, slotService };
}

describe('OrderService.refundTimeoutDispatchOrders', () => {
  it('待派单订单超过截止时间后自动全额退款', async () => {
    const order = buildOrder();
    const { service, tx, orderStatusService, slotService } = setup([order]);

    const refunded = await service.refundTimeoutDispatchOrders();

    expect(refunded).toBe(1);
    expect(orderStatusService.transit).toHaveBeenCalledWith(
      order.id,
      OrderStatus.REFUNDED,
      expect.objectContaining({ operatorType: 'SYSTEM' }),
      expect.objectContaining({ cancelReason: '超时无人接单', cancelBy: 'SYSTEM' }),
      expect.anything(),
    );

    const refundData = tx.refund.create.mock.calls[0][0].data;
    expect(refundData.amount).toBe(order.amountPayable);
    expect(refundData.status).toBe('SUCCESS');
    expect(refundData.operator).toBe('SYSTEM');
    expect(refundData.refundedAt).toBeInstanceOf(Date);

    // 时段库存必须释放，否则退款后时段会被永久占用
    expect(slotService.releaseUsed).toHaveBeenCalledWith(
      expect.any(Date),
      ['20:00', '21:00'],
      order.districtCode,
    );
  });

  it('待接单（已派出但无人接单）同样走全额退款，并作废等待中的派单', async () => {
    const order = buildOrder({ status: OrderStatus.PENDING_ACCEPT, staffId: 9n });
    const { service, tx, orderStatusService } = setup([order]);

    const refunded = await service.refundTimeoutDispatchOrders();

    expect(refunded).toBe(1);
    expect(tx.dispatch.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { orderId: order.id, status: 'PENDING' } }),
    );
    expect(orderStatusService.transit).toHaveBeenCalledWith(
      order.id,
      OrderStatus.REFUNDED,
      expect.anything(),
      expect.anything(),
      expect.anything(),
    );
  });

  it('未到截止时间的订单不退款', async () => {
    const order = buildOrder({ dispatchDeadline: new Date(Date.now() + 10 * MINUTE) });
    const { service, tx, orderStatusService, slotService } = setup([order]);

    const refunded = await service.refundTimeoutDispatchOrders();

    expect(refunded).toBe(0);
    expect(orderStatusService.transit).not.toHaveBeenCalled();
    expect(tx.refund.create).not.toHaveBeenCalled();
    expect(slotService.releaseUsed).not.toHaveBeenCalled();
  });

  it('没有截止时间的老订单按支付时间兜底：超过 60 分钟一样退款', async () => {
    const order = buildOrder({
      dispatchDeadline: null,
      paidAt: new Date(Date.now() - 2 * HOUR),
    });
    const { service, tx } = setup([order]);

    const refunded = await service.refundTimeoutDispatchOrders();

    expect(refunded).toBe(1);
    expect(tx.refund.create).toHaveBeenCalledTimes(1);
  });

  it('没有截止时间且刚支付的老订单不退款', async () => {
    const order = buildOrder({ dispatchDeadline: null, paidAt: new Date(Date.now() - MINUTE) });
    const { service, tx } = setup([order]);

    const refunded = await service.refundTimeoutDispatchOrders();

    expect(refunded).toBe(0);
    expect(tx.refund.create).not.toHaveBeenCalled();
  });

  it('退回已核销的优惠券，避免用户为平台原因买单', async () => {
    const order = buildOrder({ couponId: 7n });
    const { service, tx } = setup([order]);

    await service.refundTimeoutDispatchOrders();

    expect(tx.userCoupon.updateMany).toHaveBeenCalledWith({
      where: { id: order.couponId, orderId: order.id, status: 2 },
      data: { status: 1, orderId: null, usedAt: null },
    });
  });

  it('单笔失败不影响后续订单退款', async () => {
    const failed = buildOrder({ id: 1n, orderNo: 'HC-1' });
    const ok = buildOrder({ id: 2n, orderNo: 'HC-2' });
    const { service, orderStatusService } = setup([failed, ok]);

    orderStatusService.transit
      .mockRejectedValueOnce(new Error('订单状态已被其他操作更新'))
      .mockResolvedValueOnce(undefined);

    const refunded = await service.refundTimeoutDispatchOrders();

    expect(orderStatusService.transit).toHaveBeenCalledTimes(2);
    expect(refunded).toBe(1);
  });
});
