import { calcPrice, estimateDurationMinutes, percentOf } from './pricing';
import type { PriceInput, PriceRules } from './types';

const baseRules: PriceRules = {
  floorFeeRule: { freeFloor: 1, perFloorAmount: 500 },
  distanceFeeRule: { freeKm: 5, perKmAmount: 200 },
  holidayDates: ['2026-10-01'],
  holidayRatePercent: 120,
  nightStartHour: 20,
  nightRatePercent: 110,
};

const baseInput: PriceInput = {
  sku: { id: '2001', name: '日常保洁 3 小时', price: 15900n, durationMinutes: 180 },
  addons: [],
  address: { floor: 3, hasElevator: true, distanceKm: 3 },
  serviceDate: '2026-10-10',
  startTime: '09:00',
  coupon: null,
  rules: baseRules,
};

function withInput(patch: Partial<PriceInput>): PriceInput {
  return { ...baseInput, ...patch };
}

describe('percentOf', () => {
  it('按百分比向下取整到分', () => {
    expect(percentOf(15900n, 10)).toBe(1590n);
    expect(percentOf(999n, 10)).toBe(99n);
  });
});

describe('calcPrice 基础计价', () => {
  it('无附加项、无加价时只算服务费', () => {
    const result = calcPrice(baseInput);

    expect(result.amountService).toBe(15900n);
    expect(result.amountAddon).toBe(0n);
    expect(result.amountExtra).toBe(0n);
    expect(result.amountDiscount).toBe(0n);
    expect(result.amountPayable).toBe(15900n);
    expect(result.breakdown).toHaveLength(1);
  });

  it('多附加项按数量累加', () => {
    const result = calcPrice(
      withInput({
        addons: [
          { id: '3001', name: '擦玻璃', price: 5000n, quantity: 1, durationMinutes: 30 },
          { id: '3002', name: '空调清洗', price: 8000n, quantity: 2, durationMinutes: 40 },
        ],
      }),
    );

    expect(result.amountAddon).toBe(21000n);
    expect(result.amountPayable).toBe(36900n);
  });

  it('数量为 0 的附加项不计费', () => {
    const result = calcPrice(
      withInput({
        addons: [{ id: '3001', name: '擦玻璃', price: 5000n, quantity: 0, durationMinutes: 30 }],
      }),
    );

    expect(result.amountAddon).toBe(0n);
    expect(result.breakdown).toHaveLength(1);
  });
});

describe('calcPrice 附加费', () => {
  it('有电梯时不收楼层费', () => {
    const result = calcPrice(withInput({ address: { floor: 10, hasElevator: true, distanceKm: 3 } }));
    expect(result.amountExtra).toBe(0n);
  });

  it('无电梯且超过免费楼层时按层收费', () => {
    const result = calcPrice(withInput({ address: { floor: 6, hasElevator: false, distanceKm: 3 } }));

    // (6 - 1) 层 × 5 元
    expect(result.amountExtra).toBe(2500n);
    expect(result.amountPayable).toBe(18400n);
  });

  it('未超过免费公里数时不收里程费', () => {
    const result = calcPrice(withInput({ address: { floor: 1, hasElevator: true, distanceKm: 5 } }));
    expect(result.amountExtra).toBe(0n);
  });

  it('超里程按整公里向上取整', () => {
    const result = calcPrice(withInput({ address: { floor: 1, hasElevator: true, distanceKm: 8.2 } }));

    // 超出 3.2 公里 → 按 4 公里计
    expect(result.amountExtra).toBe(800n);
  });

  it('节假日按比例上浮', () => {
    const result = calcPrice(withInput({ serviceDate: '2026-10-01' }));

    // 15900 × 20%
    expect(result.amountExtra).toBe(3180n);
    expect(result.amountPayable).toBe(19080n);
  });

  it('夜间时段按比例上浮', () => {
    const result = calcPrice(withInput({ startTime: '20:00' }));

    // 15900 × 10%
    expect(result.amountExtra).toBe(1590n);
  });

  it('白天时段不加价', () => {
    const result = calcPrice(withInput({ startTime: '19:00' }));
    expect(result.amountExtra).toBe(0n);
  });
});

describe('calcPrice 优惠券', () => {
  it('满减券直接抵扣固定金额', () => {
    const result = calcPrice(
      withInput({
        coupon: { id: '555', name: '新客券', type: 'FIXED', value: 2000n, minAmount: 9900n },
      }),
    );

    expect(result.couponAvailable).toBe(true);
    expect(result.amountDiscount).toBe(2000n);
    expect(result.amountPayable).toBe(13900n);
  });

  it('折扣券按比例抵扣', () => {
    const result = calcPrice(
      withInput({
        coupon: { id: '556', name: '九折券', type: 'PERCENT', value: 10n, minAmount: 0n },
      }),
    );

    expect(result.amountDiscount).toBe(1590n);
    expect(result.amountPayable).toBe(14310n);
  });

  it('未达门槛时不可用且不抵扣', () => {
    const result = calcPrice(
      withInput({
        coupon: { id: '557', name: '大额券', type: 'FIXED', value: 5000n, minAmount: 50000n },
      }),
    );

    expect(result.couponAvailable).toBe(false);
    expect(result.amountDiscount).toBe(0n);
    expect(result.amountPayable).toBe(15900n);
  });

  it('抵扣金额不会超过订单金额，实付不为负', () => {
    const result = calcPrice(
      withInput({
        coupon: { id: '558', name: '超额券', type: 'FIXED', value: 99900n, minAmount: 0n },
      }),
    );

    expect(result.amountDiscount).toBe(15900n);
    expect(result.amountPayable).toBe(0n);
  });

  it('加价项参与折扣计算', () => {
    const result = calcPrice(
      withInput({
        address: { floor: 6, hasElevator: false, distanceKm: 3 },
        coupon: { id: '559', name: '九折券', type: 'PERCENT', value: 10n, minAmount: 0n },
      }),
    );

    // (15900 + 2500) × 10% = 1840，实付 16560
    expect(result.amountDiscount).toBe(1840n);
    expect(result.amountPayable).toBe(16560n);
  });
});

describe('estimateDurationMinutes', () => {
  it('规格时长与附加项时长相加', () => {
    const total = estimateDurationMinutes(
      [
        { id: '3001', name: '擦玻璃', price: 5000n, quantity: 1, durationMinutes: 30 },
        { id: '3002', name: '空调清洗', price: 8000n, quantity: 2, durationMinutes: 40 },
      ],
      180,
    );

    expect(total).toBe(290);
  });
});
