import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Matches, Max, MaxLength, Min } from 'class-validator';

export class QueryOrderDto {
  // 订单状态筛选，不传表示全部
  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  keyword?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  pageSize?: number = 10;
}

export class CancelOrderDto {
  @IsOptional()
  @IsString()
  @MaxLength(255)
  reason?: string;
}

export class RescheduleOrderDto {
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: '日期格式应为 YYYY-MM-DD' })
  serviceDate: string;

  @IsString()
  @Matches(/^\d{2}:\d{2}$/, { message: '时间格式应为 HH:mm' })
  startTime: string;
}
