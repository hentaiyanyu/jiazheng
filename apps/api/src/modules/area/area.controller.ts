import { Controller, Get, Query } from '@nestjs/common';
import { Public } from '../../common/decorators/public.decorator';
import { AreaService } from './area.service';
import { CheckAreaDto } from './dto/check-area.dto';

@Controller('areas')
export class AreaController {
  constructor(private readonly areaService: AreaService) {}

  /** 校验是否开通服务 */
  @Public()
  @Get('check')
  check(@Query() query: CheckAreaDto) {
    return this.areaService.check(query);
  }
}
