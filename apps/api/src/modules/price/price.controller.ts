import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator';
import { PriceCalculateDto } from './dto/price-calculate.dto';
import { PriceService } from './price.service';

@Controller('price')
export class PriceController {
  constructor(private readonly priceService: PriceService) {}

  /** 价格试算 */
  @Post('calculate')
  @HttpCode(200)
  calculate(@CurrentUser() user: JwtPayload, @Body() dto: PriceCalculateDto) {
    return this.priceService.calculate(BigInt(user.sub), dto);
  }
}
