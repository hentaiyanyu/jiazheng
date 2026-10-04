import { Body, Controller, Get, HttpCode, Param, Post, Query } from '@nestjs/common';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator';
import { CreateReviewDto, ReviewQueryDto } from './dto/review.dto';
import { ReviewService } from './review.service';

@Controller('reviews')
export class ReviewController {
  constructor(private readonly reviewService: ReviewService) {}

  // 提交评价
  @Post()
  @HttpCode(200)
  create(@CurrentUser() user: JwtPayload, @Body() dto: CreateReviewDto) {
    return this.reviewService.create(BigInt(user.sub), dto);
  }

  // 我的评价
  @Get('mine')
  listMine(@CurrentUser() user: JwtPayload, @Query() query: ReviewQueryDto) {
    return this.reviewService.listMine(BigInt(user.sub), query);
  }

  // 某位保洁师的评价（公开）
  @Public()
  @Get('staff/:staffId')
  listByStaff(@Param('staffId') staffId: string, @Query() query: ReviewQueryDto) {
    return this.reviewService.listByStaff(BigInt(staffId), query);
  }

  // 订单对应的评价
  @Get('order/:orderId')
  getByOrder(@CurrentUser() user: JwtPayload, @Param('orderId') orderId: string) {
    return this.reviewService.getByOrder(BigInt(orderId));
  }
}
