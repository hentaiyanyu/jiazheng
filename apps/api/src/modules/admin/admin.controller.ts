import { Body, Controller, Get, HttpCode, Param, Post, Put, Query, UseGuards } from '@nestjs/common';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator';
import { AdminGuard } from './admin.guard';
import { AdminService } from './admin.service';
import {
  AdminCancelOrderDto,
  AdminApproveRefundDto,
  AdminCreateStaffDto,
  AdminDispatchDto,
  AdminLoginDto,
  AdminOrderQueryDto,
  AdminRefundQueryDto,
  AdminUpdateStaffDto,
  AdminUpdateStaffStatusDto,
} from './dto/admin.dto';

@Controller('admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Public()
  @Post('auth/login')
  @HttpCode(200)
  login(@Body() dto: AdminLoginDto) {
    return this.adminService.login(dto.username, dto.password);
  }

  @UseGuards(AdminGuard)
  @Get('profile')
  profile(@CurrentUser() user: JwtPayload) {
    return this.adminService.getProfile(BigInt(user.adminId as string));
  }

  @UseGuards(AdminGuard)
  @Get('dashboard')
  dashboard() {
    return this.adminService.dashboard();
  }

  @UseGuards(AdminGuard)
  @Get('orders')
  listOrders(@Query() query: AdminOrderQueryDto) {
    return this.adminService.listOrders(query);
  }

  @UseGuards(AdminGuard)
  @Get('orders/:id')
  orderDetail(@Param('id') id: string) {
    return this.adminService.getOrderDetail(BigInt(id));
  }

  @UseGuards(AdminGuard)
  @Post('orders/:id/dispatch')
  @HttpCode(200)
  dispatch(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: AdminDispatchDto,
  ) {
    return this.adminService.dispatchOrder(BigInt(user.adminId as string), BigInt(id), dto);
  }

  @UseGuards(AdminGuard)
  @Post('orders/:id/cancel')
  @HttpCode(200)
  cancel(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: AdminCancelOrderDto,
  ) {
    const withRefund = dto.forceRefund !== 'false';
    return this.adminService.cancelOrder(BigInt(user.adminId as string), BigInt(id), dto.reason, withRefund);
  }

  @UseGuards(AdminGuard)
  @Get('staff')
  listStaff() {
    return this.adminService.listStaff();
  }

  @UseGuards(AdminGuard)
  @Post('staff')
  @HttpCode(200)
  createStaff(@CurrentUser() user: JwtPayload, @Body() dto: AdminCreateStaffDto) {
    return this.adminService.createStaff(BigInt(user.adminId as string), dto);
  }

  @UseGuards(AdminGuard)
  @Put('staff/:id')
  updateStaff(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: AdminUpdateStaffDto,
  ) {
    return this.adminService.updateStaff(BigInt(user.adminId as string), BigInt(id), dto);
  }

  @UseGuards(AdminGuard)
  @Post('staff/:id/status')
  @HttpCode(200)
  updateStaffStatus(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: AdminUpdateStaffStatusDto,
  ) {
    return this.adminService.updateStaffStatus(
      BigInt(user.adminId as string),
      BigInt(id),
      dto.status,
      dto.reason,
    );
  }

  @UseGuards(AdminGuard)
  @Get('regions')
  listRegions() {
    return this.adminService.listRegions();
  }

  @UseGuards(AdminGuard)
  @Get('refunds')
  listRefunds(@Query() query: AdminRefundQueryDto) {
    return this.adminService.listRefunds(query);
  }

  @UseGuards(AdminGuard)
  @Post('refunds/:id/approve')
  @HttpCode(200)
  approveRefund(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: AdminApproveRefundDto,
  ) {
    return this.adminService.approveRefund(BigInt(user.adminId as string), BigInt(id), dto.amount);
  }
}
