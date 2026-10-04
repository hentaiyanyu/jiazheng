import type { Order } from '@prisma/client';
import type { OrderStatus } from '@hc/shared';

/** Prisma 生成的订单状态类型 */
export type DbOrderStatus = Order['status'];

/**
 * Prisma 枚举 <-> 共享枚举互相转换
 *
 * 两侧的字符串值完全一致（同一份 schema 定义），
 * 仅因为 TypeScript 对枚举做名义类型检查才需要显式转换。
 */
export function toSharedStatus(status: DbOrderStatus): OrderStatus {
  return status as unknown as OrderStatus;
}

export function toDbStatus(status: OrderStatus): DbOrderStatus {
  return status as unknown as DbOrderStatus;
}
