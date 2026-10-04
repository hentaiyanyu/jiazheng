import type { PriceAddon, PriceInput, PriceResult, PriceBreakdownItem } from './types';

const HUNDRED = 100n;

/** 取金额的百分比（向下取整到分） */
export function percentOf(amount: bigint, percent: number): bigint {
  return (amount * BigInt(Math.round(percent))) / HUNDRED;
}

/** 预估总服务时长（分钟）：规格时长 + 附加项时长 */
export function estimateDurationMinutes(addons: PriceAddon[], skuDurationMinutes: number): number {
  return addons.reduce((total, addon) => total + addon.durationMinutes * addon.quantity, skuDurationMinutes);
}

/**
 * 价格计算（纯函数，无任何 IO）
 *
 * 规则优先级：服务费 → 附加项 → 楼层/里程 → 节假日/夜间加价 → 优惠券
 * 所有金额单位为「分」，使用 bigint 运算避免浮点误差。
 */
export function calcPrice(input: PriceInput): PriceResult {
  const breakdown: PriceBreakdownItem[] = [];

  // 1. 服务费与附加项
  const amountService = input.sku.price;
  breakdown.push({ label: input.sku.name, amount: amountService });

  let amountAddon = 0n;
  for (const addon of input.addons) {
    if (addon.quantity <= 0) {
      continue;
    }
    const lineTotal = addon.price * BigInt(addon.quantity);
    amountAddon += lineTotal;
    breakdown.push({ label: `${addon.name} ×${addon.quantity}`, amount: lineTotal });
  }

  const subtotal = amountService + amountAddon;

  // 2. 楼层费（无电梯且超过免费楼层）
  const { freeFloor, perFloorAmount } = input.rules.floorFeeRule;
  let floorFee = 0n;
  if (!input.address.hasElevator && input.address.floor > freeFloor) {
    const extraFloors = input.address.floor - freeFloor;
    floorFee = BigInt(perFloorAmount) * BigInt(extraFloors);
    breakdown.push({ label: `无电梯楼层费（${extraFloors} 层）`, amount: floorFee });
  }

  // 3. 里程费（超出免费公里数按整公里向上取整）
  const { freeKm, perKmAmount } = input.rules.distanceFeeRule;
  let distanceFee = 0n;
  if (input.address.distanceKm > freeKm) {
    const extraKm = Math.ceil(input.address.distanceKm - freeKm);
    distanceFee = BigInt(perKmAmount) * BigInt(extraKm);
    breakdown.push({ label: `超里程费（${extraKm} 公里）`, amount: distanceFee });
  }

  // 4. 节假日加价
  let holidayFee = 0n;
  const isHoliday = input.rules.holidayDates.includes(input.serviceDate);
  if (isHoliday && input.rules.holidayRatePercent > 100) {
    holidayFee = percentOf(subtotal, input.rules.holidayRatePercent - 100);
    if (holidayFee > 0n) {
      breakdown.push({ label: '节假日加价', amount: holidayFee });
    }
  }

  // 5. 夜间时段加价
  let nightFee = 0n;
  const startHour = Number.parseInt(input.startTime.slice(0, 2), 10);
  if (
    !Number.isNaN(startHour) &&
    startHour >= input.rules.nightStartHour &&
    input.rules.nightRatePercent > 100
  ) {
    nightFee = percentOf(subtotal, input.rules.nightRatePercent - 100);
    if (nightFee > 0n) {
      breakdown.push({ label: '夜间时段加价', amount: nightFee });
    }
  }

  const amountExtra = floorFee + distanceFee + holidayFee + nightFee;
  const totalBeforeDiscount = subtotal + amountExtra;

  // 6. 优惠券（不满足门槛则不使用，且抵扣不超过订单金额）
  let amountDiscount = 0n;
  let couponAvailable = false;

  if (input.coupon && totalBeforeDiscount >= input.coupon.minAmount) {
    couponAvailable = true;

    amountDiscount =
      input.coupon.type === 'FIXED'
        ? input.coupon.value
        : percentOf(totalBeforeDiscount, Number(input.coupon.value));

    if (amountDiscount > totalBeforeDiscount) {
      amountDiscount = totalBeforeDiscount;
    }

    if (amountDiscount > 0n) {
      breakdown.push({ label: input.coupon.name, amount: -amountDiscount });
    }
  }

  const amountPayable = totalBeforeDiscount - amountDiscount;

  return {
    amountService,
    amountAddon,
    amountExtra,
    amountDiscount,
    amountPayable,
    breakdown,
    couponAvailable,
  };
}
