/**
 * 统一错误码：0 表示成功，其余为业务或系统错误。
 *
 * 号段规划：
 *   40000–40999 参数错误
 *   40100–40199 鉴权失败
 *   40300–40399 无权限
 *   40400–40499 资源不存在
 *   40900–40999 业务冲突（状态、库存、重复提交等）
 *   42900–42999 频率限制
 *   50000+      系统错误
 */
export const ErrorCode = {
  OK: 0,

  // 参数
  PARAM_INVALID: 40001,
  PARAM_MISSING: 40002,

  // 鉴权
  UNAUTHORIZED: 40100,
  TOKEN_EXPIRED: 40101,
  TOKEN_INVALID: 40102,
  WX_LOGIN_FAILED: 40103,

  // 权限
  FORBIDDEN: 40300,
  NO_PERMISSION: 40301,

  // 资源
  NOT_FOUND: 40400,
  ORDER_NOT_FOUND: 40401,
  USER_NOT_FOUND: 40402,

  // 业务冲突
  CONFLICT_RETRY: 40900,
  SLOT_FULL: 40901,
  ORDER_STATE_INVALID: 40902,
  ADDRESS_OUT_OF_RANGE: 40903,
  COUPON_UNAVAILABLE: 40904,
  PRICE_CHANGED: 40905,
  DUPLICATE_REQUEST: 40906,
  STAFF_UNAVAILABLE: 40907,
  CHECKIN_TOO_FAR: 40908,

  // 限流
  TOO_MANY_REQUESTS: 42900,

  // 系统
  SYSTEM_ERROR: 50001,
  THIRD_PARTY_ERROR: 50002,
  PAYMENT_ERROR: 50003,
} as const;

export type ErrorCodeValue = (typeof ErrorCode)[keyof typeof ErrorCode];

/** 默认提示文案（面向用户，可直接展示） */
export const ERROR_MESSAGE: Record<number, string> = {
  [ErrorCode.OK]: 'ok',
  [ErrorCode.PARAM_INVALID]: '参数有误，请检查后重试',
  [ErrorCode.PARAM_MISSING]: '缺少必填参数',
  [ErrorCode.UNAUTHORIZED]: '请先登录',
  [ErrorCode.TOKEN_EXPIRED]: '登录已过期，请重新登录',
  [ErrorCode.TOKEN_INVALID]: '登录信息无效，请重新登录',
  [ErrorCode.WX_LOGIN_FAILED]: '微信登录失败，请重试',
  [ErrorCode.FORBIDDEN]: '无权访问',
  [ErrorCode.NO_PERMISSION]: '没有该操作权限',
  [ErrorCode.NOT_FOUND]: '数据不存在',
  [ErrorCode.ORDER_NOT_FOUND]: '订单不存在',
  [ErrorCode.USER_NOT_FOUND]: '用户不存在',
  [ErrorCode.CONFLICT_RETRY]: '操作冲突，请重试',
  [ErrorCode.SLOT_FULL]: '该时段已约满，请选择其他时间',
  [ErrorCode.ORDER_STATE_INVALID]: '当前订单状态无法执行该操作',
  [ErrorCode.ADDRESS_OUT_OF_RANGE]: '该地址暂未开通服务',
  [ErrorCode.COUPON_UNAVAILABLE]: '优惠券不满足使用条件',
  [ErrorCode.PRICE_CHANGED]: '价格已更新，请重新确认',
  [ErrorCode.DUPLICATE_REQUEST]: '请求正在处理中，请勿重复提交',
  [ErrorCode.STAFF_UNAVAILABLE]: '服务人员当前不可接单',
  [ErrorCode.CHECKIN_TOO_FAR]: '距离服务地址过远，无法签到',
  [ErrorCode.TOO_MANY_REQUESTS]: '操作过于频繁，请稍后再试',
  [ErrorCode.SYSTEM_ERROR]: '服务开小差了，请稍后重试',
  [ErrorCode.THIRD_PARTY_ERROR]: '第三方服务异常，请稍后重试',
  [ErrorCode.PAYMENT_ERROR]: '支付失败，请稍后重试',
};

export function errorMessage(code: number, fallback = '操作失败'): string {
  return ERROR_MESSAGE[code] ?? fallback;
}
