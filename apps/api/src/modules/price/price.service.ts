import { Injectable } from '@nestjs/common';
import { ErrorCode } from '@hc/shared';
import {
  calcPrice,
  estimateDurationMinutes,
  type PriceAddon,
  type PriceCoupon,
  type PriceRules,
} from '@hc/pricing';
import { BizException } from '../../common/exceptions/biz.exception';
import { PrismaService } from '../../prisma/prisma.service';
import { PriceCalculateDto } from './dto/price-calculate.dto';

/** 价格规则兜底值（未配置城市规则时使用） */
const DEFAULT_RULES: PriceRules = {
  floorFeeRule: { freeFloor: 1, perFloorAmount: 500 },
  distanceFeeRule: { freeKm: 5, perKmAmount: 200 },
  holidayDates: [],
  holidayRatePercent: 100,
  nightStartHour: 20,
  nightRatePercent: 100,
};

@Injectable()
export class PriceService {
  constructor(private readonly prisma: PrismaService) {}

  /** 价格试算：服务端为唯一权威，前端传入的金额一律不信任 */
  async calculate(userId: bigint, dto: PriceCalculateDto) {
    const sku = await this.prisma.serviceSku.findFirst({
      where: { id: BigInt(dto.skuId), serviceId: BigInt(dto.serviceId), status: 1, deletedAt: null },
    });
    if (!sku) {
      throw new BizException(ErrorCode.NOT_FOUND, '规格不存在或已下架');
    }

    const address = await this.prisma.address.findFirst({
      where: { id: BigInt(dto.addressId), userId, deletedAt: null },
    });
    if (!address) {
      throw new BizException(ErrorCode.NOT_FOUND, '地址不存在');
    }

    const addons = await this.loadAddons(sku.serviceId, dto.addons ?? []);
    const rules = await this.loadRules(address.regionCode);
    const coupon = dto.couponId ? await this.loadCoupon(userId, BigInt(dto.couponId)) : null;

    const result = calcPrice({
      sku: {
        id: sku.id.toString(),
        name: sku.name,
        price: sku.price,
        durationMinutes: sku.durationMinutes,
      },
      addons,
      address: {
        floor: address.floor,
        hasElevator: address.hasElevator,
        // 距离在派单阶段才能确定（Sprint 3），试算阶段按 0 处理
        distanceKm: 0,
      },
      serviceDate: dto.serviceDate,
      startTime: dto.startTime,
      coupon,
      rules,
    });

    return {
      amountService: Number(result.amountService),
      amountAddon: Number(result.amountAddon),
      amountExtra: Number(result.amountExtra),
      amountDiscount: Number(result.amountDiscount),
      amountPayable: Number(result.amountPayable),
      couponAvailable: result.couponAvailable,
      durationMinutes: estimateDurationMinutes(addons, sku.durationMinutes),
      breakdown: result.breakdown.map((item) => ({
        label: item.label,
        amount: Number(item.amount),
      })),
    };
  }

  /** 校验附加项必须属于该服务 */
  private async loadAddons(
    serviceId: bigint,
    items: Array<{ addonId: string; quantity: number }>,
  ): Promise<PriceAddon[]> {
    if (items.length === 0) {
      return [];
    }

    const addonIds = items.map((item) => BigInt(item.addonId));

    const [rows, relations] = await this.prisma.$transaction([
      this.prisma.serviceAddon.findMany({
        where: { id: { in: addonIds }, status: 1, deletedAt: null },
      }),
      this.prisma.serviceAddonRel.findMany({
        where: { serviceId, addonId: { in: addonIds } },
      }),
    ]);

    if (rows.length !== addonIds.length || relations.length !== addonIds.length) {
      throw new BizException(ErrorCode.PARAM_INVALID, '存在不属于该服务的附加项');
    }

    return items.map((item) => {
      const row = rows.find((r) => r.id.toString() === item.addonId)!;
      return {
        id: row.id.toString(),
        name: row.name,
        price: row.price,
        quantity: item.quantity,
        durationMinutes: row.durationMinutes,
      };
    });
  }

  /** 按行政区划向上找到城市，读取城市价格规则 */
  private async loadRules(regionCode: string): Promise<PriceRules> {
    const region = await this.prisma.region.findFirst({ where: { code: regionCode } });

    let cityCode = region?.code ?? '310000';
    if (region?.parentId) {
      const parent = await this.prisma.region.findUnique({ where: { id: region.parentId } });
      if (parent) {
        cityCode = parent.code;
      }
    }

    const rule = await this.prisma.priceRule.findFirst({ where: { cityCode, status: 1 } });
    if (!rule) {
      return DEFAULT_RULES;
    }

    return {
      floorFeeRule: rule.floorFeeRule as unknown as PriceRules['floorFeeRule'],
      distanceFeeRule: rule.distanceFeeRule as unknown as PriceRules['distanceFeeRule'],
      holidayDates: (rule.holidayDates as unknown as string[]) ?? [],
      holidayRatePercent: rule.holidayRatePercent,
      nightStartHour: rule.nightStartHour,
      nightRatePercent: rule.nightRatePercent,
    };
  }

  private async loadCoupon(userId: bigint, userCouponId: bigint): Promise<PriceCoupon> {
    const userCoupon = await this.prisma.userCoupon.findFirst({
      where: { id: userCouponId, userId, status: 1, expireAt: { gt: new Date() } },
      include: { coupon: true },
    });

    if (!userCoupon) {
      throw new BizException(ErrorCode.COUPON_UNAVAILABLE, '优惠券不存在或已过期');
    }

    return {
      id: userCoupon.id.toString(),
      name: userCoupon.coupon.name,
      type: userCoupon.coupon.type,
      value: userCoupon.coupon.value,
      minAmount: userCoupon.coupon.minAmount,
    };
  }
}
