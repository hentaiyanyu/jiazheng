/** 全局常量（前后端共用） */

export const APP_NAME = '家政清洁服务';

/** 接口统一前缀 */
export const API_PREFIX = 'api/v1';

/** 默认分页 */
export const DEFAULT_PAGE = 1;
export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;

/** JWT 主体类型 */
export enum PrincipalType {
  USER = 'USER',
  STAFF = 'STAFF',
  ADMIN = 'ADMIN',
}

/** 业务时间格式 */
export const DATE_FORMAT = 'YYYY-MM-DD';
export const TIME_FORMAT = 'HH:mm';

/** 时段配置 */
export const SLOT_MINUTES = 30;
export const SLOT_START_HOUR = 8;
/** 普通服务的最晚结束时间（小时） */
export const SLOT_END_HOUR = 20;
/** 短时长服务可延长到的最晚结束时间（支持 19:00 上门、21:00 结束） */
export const SLOT_LATE_END_HOUR = 21;
/** 适用晚间延时的服务时长（小时）：正好该时长的服务可约 19:00、21:00 结束 */
export const SLOT_LATE_MAX_HOURS = 2;
/** 最早可预约的提前量（分钟）：距开始不足该时长的时段不可预约 */
export const BOOKING_LEAD_MINUTES = 90;
/** 时段预占有效期（秒） */
export const SLOT_LOCK_TTL_SECONDS = 15 * 60;

/** 派单 */
export const DISPATCH_DEFAULT_TIMEOUT_MINUTES = 60;
export const DISPATCH_URGENT_TIMEOUT_MINUTES = 15;
/** 距离开工多久算紧急订单（小时） */
export const DISPATCH_URGENT_THRESHOLD_HOURS = 4;
/** 派给单个保洁师的等待时间（分钟） */
export const DISPATCH_STAFF_WAIT_MINUTES = 3;

/** 履约 */
export const CHECKIN_MAX_DISTANCE_METERS = 500;
export const AUTO_CONFIRM_HOURS = 48;
export const SETTLEMENT_PROTECT_HOURS = 72;

/** 订单支付超时（分钟） */
export const ORDER_PAY_TIMEOUT_MINUTES = 15;

/** 退款规则 */
// 距服务开始不足该时长（分钟）取消，收取上门费
export const DOOR_FEE_WITHIN_MINUTES = 60;
// 上门费金额（分）
export const DOOR_FEE_AMOUNT = 3000;
