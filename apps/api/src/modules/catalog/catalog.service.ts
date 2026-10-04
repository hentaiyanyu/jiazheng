import { Injectable } from '@nestjs/common';
import { ErrorCode } from '@hc/shared';
import { BizException } from '../../common/exceptions/biz.exception';
import { PrismaService } from '../../prisma/prisma.service';
import { ListServicesDto, RecommendSkuDto } from './dto/list-services.dto';
import { toCategoryVo, toServiceCardVo, toServiceDetailVo } from './vo/catalog.vo';

@Injectable()
export class CatalogService {
  constructor(private readonly prisma: PrismaService) {}

  /** 服务分类 */
  async listCategories() {
    const list = await this.prisma.category.findMany({
      where: { status: 1, deletedAt: null },
      orderBy: { sort: 'asc' },
    });
    return list.map(toCategoryVo);
  }

  /** 服务列表（分页） */
  async listServices(query: ListServicesDto) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;

    const where = {
      status: 1,
      deletedAt: null,
      ...(query.categoryId ? { categoryId: BigInt(query.categoryId) } : {}),
      ...(query.keyword ? { name: { contains: query.keyword } } : {}),
    };

    const [total, list] = await this.prisma.$transaction([
      this.prisma.service.count({ where }),
      this.prisma.service.findMany({
        where,
        orderBy: [{ sort: 'asc' }, { id: 'asc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          skus: { where: { status: 1, deletedAt: null } },
        },
      }),
    ]);

    return {
      list: list.map(toServiceCardVo),
      total,
      page,
      pageSize,
    };
  }

  /** 服务详情（含规格与可选附加项） */
  async getServiceDetail(serviceId: bigint) {
    const service = await this.prisma.service.findFirst({
      where: { id: serviceId, status: 1, deletedAt: null },
      include: {
        skus: {
          where: { status: 1, deletedAt: null },
          orderBy: [{ sort: 'asc' }, { id: 'asc' }],
        },
        addons: {
          where: { addon: { status: 1, deletedAt: null } },
          orderBy: { sort: 'asc' },
          include: { addon: true },
        },
      },
    });

    if (!service) {
      throw new BizException(ErrorCode.NOT_FOUND, '服务不存在或已下架');
    }

    return toServiceDetailVo(service);
  }

  /** 按房屋面积推荐规格 */
  async recommendSku(serviceId: bigint, query: RecommendSkuDto) {
    const skus = await this.prisma.serviceSku.findMany({
      where: { serviceId, status: 1, deletedAt: null },
      orderBy: [{ sort: 'asc' }, { id: 'asc' }],
    });

    if (skus.length === 0) {
      throw new BizException(ErrorCode.NOT_FOUND, '该服务暂无可售规格');
    }

    const area = query.area;

    if (area !== undefined) {
      const matched = skus.find(
        (sku) => sku.areaMin !== null && sku.areaMax !== null && area >= sku.areaMin && area <= sku.areaMax,
      );
      if (matched) {
        return { skuId: matched.id.toString(), name: matched.name, reason: `按 ${area}㎡ 匹配` };
      }
    }

    const fallback = skus.find((sku) => sku.isDefault) ?? skus[0];
    return {
      skuId: fallback.id.toString(),
      name: fallback.name,
      reason: area !== undefined ? '未匹配到对应面积区间，返回默认规格' : '默认推荐规格',
    };
  }
}
