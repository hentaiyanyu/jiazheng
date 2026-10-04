import { DISPATCH_DEFAULT_TIMEOUT_MINUTES, DISPATCH_URGENT_TIMEOUT_MINUTES } from '@hc/shared';
import { computeDispatchDeadline, isDispatchDeadlinePassed } from './dispatch-time.util';

describe('computeDispatchDeadline', () => {
  // 固定基准时间，避免用例依赖真实时钟
  const baseAt = new Date('2026-10-05T01:00:00.000Z');
  const serviceDate = new Date('2026-10-05T00:00:00.000Z');
  const nextDay = new Date('2026-10-06T00:00:00.000Z');
  const offsetMinutes = (deadline: Date) => (deadline.getTime() - baseAt.getTime()) / (60 * 1000);

  it('距开工超过 4 小时时使用默认超时（60 分钟）', () => {
    const deadline = computeDispatchDeadline(baseAt, serviceDate, '20:00');

    expect(offsetMinutes(deadline)).toBe(DISPATCH_DEFAULT_TIMEOUT_MINUTES);
  });

  it('距开工不足 4 小时时压缩为紧急超时（15 分钟）', () => {
    // 服务开始 = 北京时间 2026-10-05 12:00 = UTC 04:00，距基准 3 小时
    const deadline = computeDispatchDeadline(baseAt, serviceDate, '12:00');

    expect(offsetMinutes(deadline)).toBe(DISPATCH_URGENT_TIMEOUT_MINUTES);
  });

  it('距开工正好 4 小时时仍使用默认超时（边界取不到紧急档）', () => {
    const deadline = computeDispatchDeadline(baseAt, serviceDate, '13:00');

    expect(offsetMinutes(deadline)).toBe(DISPATCH_DEFAULT_TIMEOUT_MINUTES);
  });

  it('跨天服务按服务日期解析开始时间', () => {
    // 服务日期 2026-10-06，开始 09:00（北京时间）= UTC 2026-10-06 01:00，距基准 24 小时
    const deadline = computeDispatchDeadline(baseAt, nextDay, '09:00');

    expect(offsetMinutes(deadline)).toBe(DISPATCH_DEFAULT_TIMEOUT_MINUTES);
  });
});

describe('isDispatchDeadlinePassed', () => {
  const now = new Date('2026-10-05T02:00:00.000Z');

  it('未设置截止时间不算超时', () => {
    expect(isDispatchDeadlinePassed(null, now)).toBe(false);
    expect(isDispatchDeadlinePassed(undefined, now)).toBe(false);
  });

  it('截止时间早于当前时间算超时', () => {
    expect(isDispatchDeadlinePassed(new Date(now.getTime() - 1000), now)).toBe(true);
  });

  it('截止时间等于当前时间算超时', () => {
    expect(isDispatchDeadlinePassed(new Date(now.getTime()), now)).toBe(true);
  });

  it('截止时间晚于当前时间不算超时', () => {
    expect(isDispatchDeadlinePassed(new Date(now.getTime() + 1000), now)).toBe(false);
  });
});
