import { Controller, Get, Param, Query } from '@nestjs/common';
import { Public } from '../../common/decorators/public.decorator';
import { CatalogService } from './catalog.service';
import { ListServicesDto, RecommendSkuDto } from './dto/list-services.dto';

@Controller()
export class CatalogController {
  constructor(private readonly catalogService: CatalogService) {}

  /** 服务分类 */
  @Public()
  @Get('categories')
  listCategories() {
    return this.catalogService.listCategories();
  }

  /** 服务列表 */
  @Public()
  @Get('services')
  listServices(@Query() query: ListServicesDto) {
    return this.catalogService.listServices(query);
  }

  /** 服务详情 */
  @Public()
  @Get('services/:id')
  getServiceDetail(@Param('id') id: string) {
    return this.catalogService.getServiceDetail(BigInt(id));
  }

  /** 按面积推荐规格 */
  @Public()
  @Get('services/:id/recommend-sku')
  recommendSku(@Param('id') id: string, @Query() query: RecommendSkuDto) {
    return this.catalogService.recommendSku(BigInt(id), query);
  }
}
