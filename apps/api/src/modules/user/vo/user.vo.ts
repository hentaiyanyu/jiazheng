import type { User } from '@prisma/client';
import { maskPhone } from '../../../common/utils/mask.util';

/** 用户对外视图：禁止直接把数据库实体返回给前端 */
export function toUserVo(user: User) {
  return {
    id: user.id.toString(),
    nickname: user.nickname,
    avatar: user.avatar,
    phone: maskPhone(user.phone),
    hasPhone: Boolean(user.phone),
    memberLevel: user.memberLevel,
    points: user.points,
  };
}
