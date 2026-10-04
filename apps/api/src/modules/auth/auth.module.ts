import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { WechatService } from './wechat.service';

@Module({
  imports: [
    JwtModule.registerAsync({
      global: true,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_SECRET'),
        signOptions: { expiresIn: config.get<string>('JWT_EXPIRES_IN') ?? '2h' },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    WechatService,
    // 全局登录守卫：默认所有接口都需要登录，@Public() 例外
    { provide: APP_GUARD, useClass: JwtAuthGuard },
  ],
  exports: [AuthService, WechatService],
})
export class AuthModule {}
