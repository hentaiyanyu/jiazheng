import { Type } from 'class-transformer';
import {
  IsArray,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

export class OrderAddonItemDto {
  @IsString()
  @IsNotEmpty()
  addonId: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(20)
  quantity: number;
}

export class CreateOrderDto {
  // 幂等键，由客户端生成；同一 requestId 只会创建一张订单
  @IsString()
  @IsNotEmpty({ message: 'requestId 不能为空' })
  @MaxLength(64)
  requestId: string;

  @IsString()
  @IsNotEmpty({ message: 'serviceId 不能为空' })
  serviceId: string;

  @IsString()
  @IsNotEmpty({ message: 'skuId 不能为空' })
  skuId: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OrderAddonItemDto)
  addons?: OrderAddonItemDto[];

  @IsString()
  @IsNotEmpty({ message: 'addressId 不能为空' })
  addressId: string;

  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: '日期格式应为 YYYY-MM-DD' })
  serviceDate: string;

  @IsString()
  @Matches(/^\d{2}:\d{2}$/, { message: '时间格式应为 HH:mm' })
  startTime: string;

  @IsOptional()
  @IsString()
  couponId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  remark?: string;

  // 客户端试算金额（分），用于校验价格是否变化
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  expectedAmount?: number;
}
