import { SLOT_END_HOUR } from './constants';

/**
 * 展开一次服务实际占用的时段
 *
 * 超出排班范围（>= SLOT_END_HOUR）的小时不占用：
 * 例如 19:00 开始的 2 小时服务，排班表只覆盖 19:00-20:00 这一段，
 * 服务实际到 21:00，但库存只扣 19:00 这一格。
 *
 * @param startTime 起始时间，形如 "09:00"
 * @param hours 服务时长（小时，向上取整）
 */
export function buildOccupiedTimes(startTime: string, hours: number): string[] {
  const startHour = Number.parseInt(startTime.slice(0, 2), 10);
  const times: string[] = [];

  for (let i = 0; i < Math.max(1, hours); i += 1) {
    const hour = startHour + i;

    if (hour >= SLOT_END_HOUR) {
      break;
    }

    times.push(`${String(hour).padStart(2, '0')}:00`);
  }

  return times.length > 0 ? times : [`${String(startHour).padStart(2, '0')}:00`];
}
