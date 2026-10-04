import { Body, Controller, Get, HttpCode, Post } from '@nestjs/common';
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator';
import { BindPhoneDto } from './dto/bind-phone.dto';
import { UserService } from './user.service';

@Controller('user')
export class UserController {
  constructor(private readonly userService: UserService) {}

  /** 获取当前用户信息 */
  @Get('profile')
  getProfile(@CurrentUser() user: JwtPayload) {
    return this.userService.getProfile(BigInt(user.sub));
  }

  /** 绑定手机号（下单前必需） */
  @Post('phone')
  @HttpCode(200)
  bindPhone(@CurrentUser() user: JwtPayload, @Body() dto: BindPhoneDto) {
    return this.userService.bindPhone(BigInt(user.sub), dto.code);
  }
}
