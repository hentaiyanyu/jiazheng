import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { validateEnv } from './config/env.validation';
import { PrismaModule } from './prisma/prisma.module';
import { AddressModule } from './modules/address/address.module';
import { AdminModule } from './modules/admin/admin.module';
import { AreaModule } from './modules/area/area.module';
import { AuthModule } from './modules/auth/auth.module';
import { CatalogModule } from './modules/catalog/catalog.module';
import { HealthModule } from './modules/health/health.module';
import { OrderModule } from './modules/order/order.module';
import { NotifyModule } from './modules/notify/notify.module';
import { PaymentModule } from './modules/payment/payment.module';
import { PriceModule } from './modules/price/price.module';
import { ReviewModule } from './modules/review/review.module';
import { StaffModule } from './modules/staff/staff.module';
import { TimeSlotModule } from './modules/timeslot/timeslot.module';
import { UploadModule } from './modules/upload/upload.module';
import { UserModule } from './modules/user/user.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env'],
      validate: validateEnv,
    }),
    PrismaModule,
    HealthModule,
    AuthModule,
    UserModule,
    CatalogModule,
    AddressModule,
    AreaModule,
    TimeSlotModule,
    PriceModule,
    PaymentModule,
    OrderModule,
    StaffModule,
    AdminModule,
    ReviewModule,
    UploadModule,
    NotifyModule,
  ],
})
export class AppModule {}
