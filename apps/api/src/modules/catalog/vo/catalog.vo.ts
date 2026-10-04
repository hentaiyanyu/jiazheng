import type { Category, Service, ServiceAddon, ServiceSku } from '@prisma/client';

/** 分类视图 */
export function toCategoryVo(category: Category) {
  return {
    id: category.id.toString(),
    name: category.name,
    icon: category.icon,
  };
}

type ServiceWithSkus = Service & { skus?: ServiceSku[] };

/** 服务卡片视图（列表页用） */
export function toServiceCardVo(service: ServiceWithSkus) {
  return {
    id: service.id.toString(),
    name: service.name,
    subtitle: service.subtitle,
    coverImg: service.coverImg,
    priceType: service.priceType,
    priceMin: Number(service.basePriceMin),
    priceMax: Number(service.basePriceMax),
    durationMinutes: service.durationMinutes,
    skuCount: service.skus?.length ?? 0,
  };
}

type ServiceDetail = Service & {
  skus: ServiceSku[];
  addons: Array<{ addon: ServiceAddon }>;
};

/** 服务详情视图 */
export function toServiceDetailVo(service: ServiceDetail) {
  return {
    id: service.id.toString(),
    categoryId: service.categoryId.toString(),
    name: service.name,
    subtitle: service.subtitle,
    coverImg: service.coverImg,
    images: (service.images as string[] | null) ?? [],
    description: service.description,
    includedItems: (service.includedItems as string[] | null) ?? [],
    excludedItems: (service.excludedItems as string[] | null) ?? [],
    notice: service.notice,
    priceType: service.priceType,
    priceMin: Number(service.basePriceMin),
    priceMax: Number(service.basePriceMax),
    durationMinutes: service.durationMinutes,
    staffCount: service.staffCount,
    skus: service.skus.map((sku) => ({
      id: sku.id.toString(),
      name: sku.name,
      price: Number(sku.price),
      durationMinutes: sku.durationMinutes,
      areaMin: sku.areaMin,
      areaMax: sku.areaMax,
      isDefault: sku.isDefault,
    })),
    addons: service.addons.map((rel) => ({
      id: rel.addon.id.toString(),
      name: rel.addon.name,
      price: Number(rel.addon.price),
      unit: rel.addon.unit,
      durationMinutes: rel.addon.durationMinutes,
    })),
  };
}
