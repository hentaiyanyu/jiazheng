import { Body, Controller, Get, HttpCode, Param, Post, Query } from '@nestjs/common';
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator';
import { CreateOrderDto } from './dto/create-order.dto';
import { CancelOrderDto, QueryOrderDto, RescheduleOrderDto } from './dto/query-order.dto';
import { OrderService } from './order.service';

@Controller('orders')
export class OrderController {
  constructor(private readonly orderService: OrderService) {}

  // 创建订单
  @Post()
  @HttpCode(200)
  create(@CurrentUser() user: JwtPayload, @Body() dto: CreateOrderDto) {
    return this.orderService.create(BigInt(user.sub), dto);
  }

  // 订单列表
  @Get()
  list(@CurrentUser() user: JwtPayload, @Query() query: QueryOrderDto) {
    return this.orderService.list(BigInt(user.sub), query);
  }

  // 订单详情
  @Get(':id')
  detail(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.orderService.detail(BigInt(user.sub), BigInt(id));
  }

  // 再来一单
  @Post(':id/repeat')
  @HttpCode(200)
  repeat(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.orderService.repeat(BigInt(user.sub), BigInt(id));
  }

  // 取消订单
  @Post(':id/cancel')
  @HttpCode(200)
  cancel(@CurrentUser() user: JwtPayload, @Param('id') id: string, @Body() dto: CancelOrderDto) {
    return this.orderService.cancel(BigInt(user.sub), BigInt(id), dto);
  }

  // 确认完工
  @Post(':id/confirm')
  @HttpCode(200)
  confirm(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.orderService.confirm(BigInt(user.sub), BigInt(id));
  }

  // 改期
  @Post(':id/reschedule')
  @HttpCode(200)
  reschedule(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: RescheduleOrderDto,
  ) {
    return this.orderService.reschedule(BigInt(user.sub), BigInt(id), dto);
  }
}
