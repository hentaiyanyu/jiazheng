import {
  DISPATCH_DEFAULT_TIMEOUT_MINUTES,
  DISPATCH_URGENT_THRESHOLD_HOURS,
  DISPATCH_URGENT_TIMEOUT_MINUTES,
} from '@hc/shared';
import { resolveServiceStartAt } from './service-time.util';

/**
 * 派单兜底截止时间
 *
 * 规则（设计文档 5.4 / 6.5）：支付或重新派单后，默认 60 分钟内无人接单即自动全额退款；
 * 距开工不足 4 小时的紧急订单压缩为 15 分钟，避免退款拖到服务时间之后。
 */
export function computeDispatchDeadline(baseAt: Date, serviceDate: Date, startTime: string): Date {
  const minutesUntilStart =
    (resolveServiceStartAt(serviceDate, startTime).getTime() - baseAt.getTime()) / (60 * 1000);

  const timeoutMinutes =
    minutesUntilStart < DISPATCH_URGENT_THRESHOLD_HOURS * 60
      ? DISPATCH_URGENT_TIMEOUT_MINUTES
      : DISPATCH_DEFAULT_TIMEOUT_MINUTES;

  return new Date(baseAt.getTime() + timeoutMinutes * 60 * 1000);
}

/** 是否已超过派单截止时间（没有设置截止时间时按未超时处理） */
export function isDispatchDeadlinePassed(
  deadline: Date | null | undefined,
  now: Date = new Date(),
): boolean {
  return Boolean(deadline) && (deadline as Date).getTime() <= now.getTime();
}
