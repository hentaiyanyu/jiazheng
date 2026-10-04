import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export class ListServicesDto {
  @IsOptional()
  @IsString()
  categoryId?: string;

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
  @Max(100)
  pageSize?: number = 20;
}

export class RecommendSkuDto {
  /** 房屋面积（㎡） */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  area?: number;

  /** 房间数 */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  rooms?: number;
}
