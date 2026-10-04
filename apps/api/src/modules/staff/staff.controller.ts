import { Body, Controller, Get, HttpCode, Param, Post, Query, UseGuards } from '@nestjs/common';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator';
import {
  StaffCheckinDto,
  StaffFinishDto,
  StaffLoginDto,
  StaffRejectDto,
  StaffTaskQueryDto,
} from './dto/staff.dto';
import { StaffGuard } from './staff.guard';
import { StaffService } from './staff.service';

@Controller('staff')
export class StaffController {
  constructor(private readonly staffService: StaffService) {}

  // 保洁师登录
  @Public()
  @Post('auth/login')
  @HttpCode(200)
  login(@Body() dto: StaffLoginDto) {
    return this.staffService.login(dto.code);
  }

  @UseGuards(StaffGuard)
  @Get('profile')
  profile(@CurrentUser() user: JwtPayload) {
    return this.staffService.getProfile(BigInt(user.staffId as string));
  }

  @UseGuards(StaffGuard)
  @Get('tasks')
  tasks(@CurrentUser() user: JwtPayload, @Query() query: StaffTaskQueryDto) {
    return this.staffService.listTasks(BigInt(user.staffId as string), query.tab);
  }

  // 单个任务详情
  @UseGuards(StaffGuard)
  @Get('tasks/:orderId')
  taskDetail(@CurrentUser() user: JwtPayload, @Param('orderId') orderId: string) {
    return this.staffService.getTaskDetail(BigInt(user.staffId as string), BigInt(orderId));
  }

  @UseGuards(StaffGuard)
  @Post('tasks/:orderId/accept')
  @HttpCode(200)
  accept(@CurrentUser() user: JwtPayload, @Param('orderId') orderId: string) {
    return this.staffService.accept(BigInt(user.staffId as string), BigInt(orderId));
  }

  @UseGuards(StaffGuard)
  @Post('tasks/:orderId/reject')
  @HttpCode(200)
  reject(
    @CurrentUser() user: JwtPayload,
    @Param('orderId') orderId: string,
    @Body() dto: StaffRejectDto,
  ) {
    return this.staffService.reject(BigInt(user.staffId as string), BigInt(orderId), dto.reason);
  }

  @UseGuards(StaffGuard)
  @Post('tasks/:orderId/checkin')
  @HttpCode(200)
  checkin(
    @CurrentUser() user: JwtPayload,
    @Param('orderId') orderId: string,
    @Body() dto: StaffCheckinDto,
  ) {
    return this.staffService.checkin(BigInt(user.staffId as string), BigInt(orderId), dto);
  }

  @UseGuards(StaffGuard)
  @Post('tasks/:orderId/finish')
  @HttpCode(200)
  finish(
    @CurrentUser() user: JwtPayload,
    @Param('orderId') orderId: string,
    @Body() dto: StaffFinishDto,
  ) {
    return this.staffService.finish(BigInt(user.staffId as string), BigInt(orderId), dto);
  }

  @UseGuards(StaffGuard)
  @Get('income')
  income(@CurrentUser() user: JwtPayload) {
    return this.staffService.income(BigInt(user.staffId as string));
  }
}
