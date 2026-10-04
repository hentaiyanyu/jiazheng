import { IsNotEmpty, IsOptional, IsString, Length, Matches } from 'class-validator';

export class TimeSlotQueryDto {
  @IsString()
  @IsNotEmpty({ message: 'serviceId 不能为空' })
  serviceId: string;

  @IsOptional()
  @IsString()
  skuId?: string;

  /** 服务日期 YYYY-MM-DD */
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: '日期格式应为 YYYY-MM-DD' })
  date: string;

  @IsString()
  @Length(6, 12)
  districtCode: string;
}
