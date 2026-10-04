import type { Staff } from '@prisma/client';
import { maskPhone } from '../../../common/utils/mask.util';

export function toStaffVo(staff: Staff) {
  return {
    id: staff.id.toString(),
    name: staff.name,
    avatar: staff.avatar,
    phone: maskPhone(staff.phone),
    level: staff.level,
    // 对外展示一位小数
    rating: Number((staff.ratingX10 / 10).toFixed(1)),
    orderCount: staff.orderCount,
    acceptRate: staff.acceptRate,
    onTimeRate: staff.onTimeRate,
    settlementRate: staff.settlementRate,
    skillTags: (staff.skillTags as string[] | null) ?? [],
    serviceDistricts: (staff.serviceDistricts as string[] | null) ?? [],
    status: staff.status,
  };
}
