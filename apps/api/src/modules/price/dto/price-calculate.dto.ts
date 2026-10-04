import { Type } from 'class-transformer';
import {
  IsArray,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';

export class PriceAddonItemDto {
  @IsString()
  @IsNotEmpty()
  addonId: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(20)
  quantity: number;
}

export class PriceCalculateDto {
  @IsString()
  @IsNotEmpty({ message: 'serviceId 不能为空' })
  serviceId: string;

  @IsString()
  @IsNotEmpty({ message: 'skuId 不能为空' })
  skuId: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PriceAddonItemDto)
  addons?: PriceAddonItemDto[];

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
}
