/**
 * 订单状态与状态机定义（前后端共用）
 *
 * 命名规范：状态值即数据库存储值，禁止随意改动已有枚举值。
 */
export enum OrderStatus {
  /** 待支付：已创建未支付，15 分钟后自动关闭 */
  PENDING_PAYMENT = 'PENDING_PAYMENT',
  /** 待派单：已支付，等待派单 */
  PENDING_DISPATCH = 'PENDING_DISPATCH',
  /** 待接单：已派给保洁师，等待确认 */
  PENDING_ACCEPT = 'PENDING_ACCEPT',
  /** 待服务：保洁师已接单，等待上门 */
  PENDING_SERVICE = 'PENDING_SERVICE',
  /** 服务中：保洁师已签到 */
  IN_SERVICE = 'IN_SERVICE',
  /** 待确认：服务完成，等待用户确认 */
  PENDING_CONFIRM = 'PENDING_CONFIRM',
  /** 已完成 */
  COMPLETED = 'COMPLETED',
  /** 已改期 */
  RESCHEDULED = 'RESCHEDULED',
  /** 已取消 */
  CANCELED = 'CANCELED',
  /** 售后中 */
  AFTER_SALES = 'AFTER_SALES',
  /** 已退款 */
  REFUNDED = 'REFUNDED',
  /** 异常（未签到、无人应门等） */
  EXCEPTION = 'EXCEPTION',
}

/** 状态中文文案 */
export const ORDER_STATUS_TEXT: Record<OrderStatus, string> = {
  [OrderStatus.PENDING_PAYMENT]: '待支付',
  [OrderStatus.PENDING_DISPATCH]: '待派单',
  [OrderStatus.PENDING_ACCEPT]: '待接单',
  [OrderStatus.PENDING_SERVICE]: '待服务',
  [OrderStatus.IN_SERVICE]: '服务中',
  [OrderStatus.PENDING_CONFIRM]: '待确认',
  [OrderStatus.COMPLETED]: '已完成',
  [OrderStatus.RESCHEDULED]: '已改期',
  [OrderStatus.CANCELED]: '已取消',
  [OrderStatus.AFTER_SALES]: '售后中',
  [OrderStatus.REFUNDED]: '已退款',
  [OrderStatus.EXCEPTION]: '异常',
};

/**
 * 允许的状态流转。
 * key = 当前状态，value = 可流转到的目标状态集合。
 */
export const ORDER_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  [OrderStatus.PENDING_PAYMENT]: [OrderStatus.PENDING_DISPATCH, OrderStatus.CANCELED],
  [OrderStatus.PENDING_DISPATCH]: [
    OrderStatus.PENDING_ACCEPT,
    OrderStatus.PENDING_DISPATCH,
    OrderStatus.RESCHEDULED,
    OrderStatus.REFUNDED,
    OrderStatus.CANCELED,
  ],
  [OrderStatus.PENDING_ACCEPT]: [
    OrderStatus.PENDING_SERVICE,
    OrderStatus.PENDING_DISPATCH,
    OrderStatus.RESCHEDULED,
    OrderStatus.REFUNDED,
    OrderStatus.CANCELED,
  ],
  [OrderStatus.PENDING_SERVICE]: [
    OrderStatus.IN_SERVICE,
    OrderStatus.RESCHEDULED,
    OrderStatus.CANCELED,
    OrderStatus.EXCEPTION,
  ],
  [OrderStatus.IN_SERVICE]: [OrderStatus.PENDING_CONFIRM, OrderStatus.EXCEPTION],
  [OrderStatus.PENDING_CONFIRM]: [OrderStatus.COMPLETED, OrderStatus.AFTER_SALES],
  [OrderStatus.COMPLETED]: [OrderStatus.AFTER_SALES],
  // 改期后回到待派单，重新匹配保洁师（原保洁师在新时间不一定有空）
  [OrderStatus.RESCHEDULED]: [OrderStatus.PENDING_DISPATCH, OrderStatus.PENDING_SERVICE, OrderStatus.CANCELED],
  [OrderStatus.EXCEPTION]: [OrderStatus.PENDING_SERVICE, OrderStatus.REFUNDED],
  [OrderStatus.AFTER_SALES]: [OrderStatus.REFUNDED, OrderStatus.COMPLETED],
  [OrderStatus.CANCELED]: [],
  [OrderStatus.REFUNDED]: [],
};

/** 是否为终态（不可再流转） */
export const TERMINAL_STATUSES: OrderStatus[] = [OrderStatus.CANCELED, OrderStatus.REFUNDED];

/**
 * 判断状态流转是否合法。
 * 所有订单状态变更必须先过这里，禁止直接改库。
 */
export function canTransit(from: OrderStatus, to: OrderStatus): boolean {
  return ORDER_TRANSITIONS[from]?.includes(to) ?? false;
}

export function isTerminal(status: OrderStatus): boolean {
  return TERMINAL_STATUSES.includes(status);
}

/**
 * 前端可执行的操作，由服务端随订单详情下发，
 * 前端据此渲染按钮，规则变更无需发版。
 */
export type OrderAction =
  | 'PAY'
  | 'CANCEL'
  | 'RESCHEDULE'
  | 'CONTACT_STAFF'
  | 'CONTACT_USER'
  | 'CONFIRM_FINISH'
  | 'REVIEW'
  | 'REPEAT'
  | 'APPLY_AFTER_SALES'
  | 'ACCEPT'
  | 'REJECT'
  | 'DEPART'
  | 'CHECKIN'
  | 'FINISH';

/** 用户端在各状态下可执行的操作 */
export const USER_ACTIONS_BY_STATUS: Record<OrderStatus, OrderAction[]> = {
  [OrderStatus.PENDING_PAYMENT]: ['PAY', 'CANCEL'],
  [OrderStatus.PENDING_DISPATCH]: ['CANCEL', 'RESCHEDULE'],
  [OrderStatus.PENDING_ACCEPT]: ['CANCEL', 'RESCHEDULE'],
  [OrderStatus.PENDING_SERVICE]: ['CANCEL', 'RESCHEDULE', 'CONTACT_STAFF'],
  [OrderStatus.IN_SERVICE]: ['CONTACT_STAFF'],
  [OrderStatus.PENDING_CONFIRM]: ['CONFIRM_FINISH', 'CONTACT_STAFF'],
  [OrderStatus.COMPLETED]: ['REVIEW', 'REPEAT', 'APPLY_AFTER_SALES'],
  [OrderStatus.RESCHEDULED]: ['CONTACT_STAFF'],
  [OrderStatus.CANCELED]: ['REPEAT'],
  [OrderStatus.AFTER_SALES]: [],
  [OrderStatus.REFUNDED]: ['REPEAT'],
  [OrderStatus.EXCEPTION]: ['CANCEL'],
};

/** 保洁师端在各状态下可执行的操作 */
export const STAFF_ACTIONS_BY_STATUS: Record<OrderStatus, OrderAction[]> = {
  [OrderStatus.PENDING_PAYMENT]: [],
  [OrderStatus.PENDING_DISPATCH]: [],
  [OrderStatus.PENDING_ACCEPT]: ['ACCEPT', 'REJECT'],
  // 到店后拍照打卡（拍照 + 定位），不再单独设「出发」环节
  [OrderStatus.PENDING_SERVICE]: ['CHECKIN', 'CONTACT_USER'],
  [OrderStatus.IN_SERVICE]: ['FINISH', 'CONTACT_USER'],
  [OrderStatus.PENDING_CONFIRM]: [],
  [OrderStatus.COMPLETED]: [],
  [OrderStatus.RESCHEDULED]: [],
  [OrderStatus.CANCELED]: [],
  [OrderStatus.AFTER_SALES]: [],
  [OrderStatus.REFUNDED]: [],
  [OrderStatus.EXCEPTION]: [],
};

/** 订单操作中文文案 */
export const ORDER_ACTION_TEXT: Record<OrderAction, string> = {
  PAY: '立即支付',
  CANCEL: '取消订单',
  RESCHEDULE: '改期',
  CONTACT_STAFF: '联系服务人员',
  CONTACT_USER: '联系客户',
  CONFIRM_FINISH: '确认完工',
  REVIEW: '去评价',
  REPEAT: '再来一单',
  APPLY_AFTER_SALES: '申请售后',
  ACCEPT: '接单',
  REJECT: '拒单',
  DEPART: '出发',
  CHECKIN: '到店签到',
  FINISH: '完工上报',
};
