/** 楼层费规则：perFloorAmount 单位为分 */
export interface FloorFeeRule {
  freeFloor: number;
  perFloorAmount: number;
}

/** 里程费规则：perKmAmount 单位为分 */
export interface DistanceFeeRule {
  freeKm: number;
  perKmAmount: number;
}

/** 城市级价格规则 */
export interface PriceRules {
  floorFeeRule: FloorFeeRule;
  distanceFeeRule: DistanceFeeRule;
  /** 节假日日期，格式 YYYY-MM-DD */
  holidayDates: string[];
  /** 节假日加价百分比，120 表示上浮 20% */
  holidayRatePercent: number;
  /** 夜间起始小时（含） */
  nightStartHour: number;
  /** 夜间加价百分比 */
  nightRatePercent: number;
}

export interface PriceSku {
  id: string;
  name: string;
  /** 价格，单位分 */
  price: bigint;
  durationMinutes: number;
}

export interface PriceAddon {
  id: string;
  name: string;
  /** 单价，单位分 */
  price: bigint;
  quantity: number;
  durationMinutes: number;
}

export interface PriceAddress {
  /** 楼层 */
  floor: number;
  /** 是否有电梯 */
  hasElevator: boolean;
  /** 距离服务网点/保洁师的距离（公里） */
  distanceKm: number;
}

export type CouponKind = 'FIXED' | 'PERCENT';

export interface PriceCoupon {
  id: string;
  name: string;
  type: CouponKind;
  /** FIXED：减免金额（分）；PERCENT：减免百分比（10 表示减 10%） */
  value: bigint;
  /** 使用门槛（分） */
  minAmount: bigint;
}

export interface PriceInput {
  sku: PriceSku;
  addons: PriceAddon[];
  address: PriceAddress;
  /** YYYY-MM-DD */
  serviceDate: string;
  /** HH:mm */
  startTime: string;
  coupon?: PriceCoupon | null;
  rules: PriceRules;
}

export interface PriceBreakdownItem {
  label: string;
  /** 金额（分），优惠项为负数 */
  amount: bigint;
}

export interface PriceResult {
  amountService: bigint;
  amountAddon: bigint;
  amountExtra: bigint;
  amountDiscount: bigint;
  amountPayable: bigint;
  breakdown: PriceBreakdownItem[];
  /** 优惠券是否满足使用条件 */
  couponAvailable: boolean;
}
