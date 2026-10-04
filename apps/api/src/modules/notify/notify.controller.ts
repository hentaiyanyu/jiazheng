import { Body, Controller, Get, HttpCode, Post, Query } from '@nestjs/common';
import { PrincipalType } from '@hc/shared';
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator';
import { MarkReadDto, NotifyQueryDto } from './dto/notify.dto';
import { NotifyService, ReceiverType } from './notify.service';

@Controller('notifications')
export class NotifyController {
  constructor(private readonly notifyService: NotifyService) {}

  // 按登录主体自动区分用户 / 保洁师的消息
  private resolveReceiver(user: JwtPayload): { type: ReceiverType; id: bigint } {
    if (user.type === PrincipalType.STAFF && user.staffId) {
      return { type: 'STAFF', id: BigInt(user.staffId) };
    }
    return { type: 'USER', id: BigInt(user.sub) };
  }

  @Get()
  list(@CurrentUser() user: JwtPayload, @Query() query: NotifyQueryDto) {
    const receiver = this.resolveReceiver(user);
    return this.notifyService.list(receiver.type, receiver.id, query);
  }

  @Get('unread-count')
  unreadCount(@CurrentUser() user: JwtPayload) {
    const receiver = this.resolveReceiver(user);
    return this.notifyService.unreadCount(receiver.type, receiver.id);
  }

  @Post('read')
  @HttpCode(200)
  markRead(@CurrentUser() user: JwtPayload, @Body() dto: MarkReadDto) {
    const receiver = this.resolveReceiver(user);
    return this.notifyService.markRead(receiver.type, receiver.id, dto.id);
  }
}
