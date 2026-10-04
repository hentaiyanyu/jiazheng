import type { Order } from '@prisma/client';
import { ORDER_STATUS_TEXT, STAFF_ACTIONS_BY_STATUS, USER_ACTIONS_BY_STATUS } from '@hc/shared';
import { signFileUrl } from '../../../common/utils/file-url.util';
import { toSharedStatus } from '../order-status.util';

function formatDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export interface OrderVoExtra {
  // 视角：用户端 / 保洁师端，决定下发哪些可执行操作
  role?: 'USER' | 'STAFF';
  // 是否已评价：已评价则不再下发「去评价」操作
  reviewed?: boolean;
  staff?: {
    id: string;
    name: string;
    rating: number;
  } | null;
}

// 订单对外视图（禁止直接返回数据库实体）
export function toOrderVo(order: Order, extra: OrderVoExtra = {}) {
  const status = toSharedStatus(order.status);
  const actionMap = extra.role === 'STAFF' ? STAFF_ACTIONS_BY_STATUS : USER_ACTIONS_BY_STATUS;

  return {
    orderId: order.id.toString(),
    orderNo: order.orderNo,
    status,
    statusText: ORDER_STATUS_TEXT[status] ?? String(order.status),
    serviceDate: formatDate(order.serviceDate),
    startTime: order.startTime,
    endTime: order.endTime,
    durationMinutes: order.durationMinutes,
    districtCode: order.districtCode,
    address: order.addressSnapshot,
    service: order.serviceSnapshot,
    staff: extra.staff ?? null,
    amount: {
      service: Number(order.amountService),
      addon: Number(order.amountAddon),
      extra: Number(order.amountExtra),
      discount: Number(order.amountDiscount),
      payable: Number(order.amountPayable),
    },
    remark: order.remark,
    images: {
      // 返回带签名的地址，避免照片被公开访问
      checkin: signFileUrl(order.checkinImage) || null,
      finish: ((order.finishImages as string[] | null) ?? []).map((url) => signFileUrl(url)),
    },
    payExpireAt: order.payExpireAt,
    paidAt: order.paidAt,
    canceledAt: order.canceledAt,
    cancelReason: order.cancelReason,
    createdAt: order.createdAt,
    // 由服务端下发可执行操作，前端据此渲染按钮
    actions: (actionMap[status] ?? []).filter((action) =>
      extra.reviewed && action === 'REVIEW' ? false : true,
    ),
  };
}
