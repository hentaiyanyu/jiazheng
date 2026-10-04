import { IsOptional, IsString, Length } from 'class-validator';

export class CheckAreaDto {
  /** 行政区划代码，如 310115 */
  @IsString()
  @Length(6, 12)
  districtCode: string;

  @IsOptional()
  @IsString()
  communityId?: string;
}
