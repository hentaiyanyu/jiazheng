import { Type } from 'class-transformer';
import {
  IsArray,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  ArrayMinSize,
  MaxLength,
} from 'class-validator';

export class StaffLoginDto {
  @IsString()
  @IsNotEmpty({ message: 'code 不能为空' })
  @MaxLength(256)
  code: string;
}

export class StaffRejectDto {
  @IsString()
  @IsNotEmpty({ message: '请填写拒单原因' })
  @MaxLength(255)
  reason: string;
}

export class StaffCheckinDto {
  @Type(() => Number)
  @IsNumber()
  lng: number;

  @Type(() => Number)
  @IsNumber()
  lat: number;

  // 打卡照片地址（必填，作为到店凭证）
  @IsString()
  @IsNotEmpty({ message: '请先拍照再打卡' })
  image: string;
}

export class StaffFinishDto {
  @IsArray()
  @ArrayMinSize(1, { message: '请至少上传一张完工照片' })
  images?: string[];

  @IsOptional()
  @IsString()
  @MaxLength(255)
  remark?: string;
}

export class StaffTaskQueryDto {
  // PENDING / SERVING / FINISHED
  @IsOptional()
  @IsString()
  tab?: string;
}
