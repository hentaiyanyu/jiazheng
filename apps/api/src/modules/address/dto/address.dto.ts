import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
} from 'class-validator';

export class SaveAddressDto {
  @IsString()
  @IsNotEmpty({ message: '联系人不能为空' })
  @MaxLength(32)
  contactName: string;

  @IsString()
  @Matches(/^1\d{10}$/, { message: '手机号格式不正确' })
  contactPhone: string;

  @IsString()
  @IsNotEmpty({ message: '省份不能为空' })
  province: string;

  @IsString()
  @IsNotEmpty({ message: '城市不能为空' })
  city: string;

  @IsString()
  @IsNotEmpty({ message: '区县不能为空' })
  district: string;

  /** 行政区划代码 */
  @IsString()
  @IsNotEmpty({ message: '行政区划代码不能为空' })
  regionCode: string;

  @IsOptional()
  @IsString()
  communityId?: string;

  @IsString()
  @IsNotEmpty({ message: '详细地址不能为空' })
  @MaxLength(255)
  detail: string;

  @Type(() => Number)
  @IsNumber()
  lng: number;

  @Type(() => Number)
  @IsNumber()
  lat: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  floor?: number;

  @IsOptional()
  @IsBoolean()
  hasElevator?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(16)
  tag?: string;

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}
