/**
 * 服务时间工具
 *
 * serviceDate 是 DATE 列（按 UTC 零点存储），startTime 是 "HH:mm" 字符串。
 * 业务时区固定为北京时间（+08:00），集中在这里解析，避免各处重复拼时间字符串。
 */

/** 业务时区相对 UTC 的偏移 */
export const SERVICE_TIMEZONE_OFFSET = '+08:00';

/** DATE 列统一按 UTC 零点处理 */
export function toDateOnly(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

/** 服务实际开始时间点 */
export function resolveServiceStartAt(serviceDate: Date, startTime: string): Date {
  return new Date(
    `${serviceDate.toISOString().slice(0, 10)}T${startTime}:00${SERVICE_TIMEZONE_OFFSET}`,
  );
}

/** 距服务开始的剩余分钟数（负数表示已过开始时间） */
export function minutesUntilServiceStart(
  serviceDate: Date,
  startTime: string,
  now: Date = new Date(),
): number {
  return (resolveServiceStartAt(serviceDate, startTime).getTime() - now.getTime()) / 60000;
}
