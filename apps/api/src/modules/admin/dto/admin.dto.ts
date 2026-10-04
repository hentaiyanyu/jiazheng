import { Type } from 'class-transformer';
import {
  IsArray,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class AdminLoginDto {
  @IsString()
  @IsNotEmpty({ message: '用户名不能为空' })
  @MaxLength(32)
  username: string;

  @IsString()
  @IsNotEmpty({ message: '密码不能为空' })
  @MaxLength(64)
  password: string;
}

export class AdminOrderQueryDto {
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
  pageSize?: number = 20;
}

export class AdminCancelOrderDto {
  @IsString()
  @IsNotEmpty({ message: '请填写取消原因' })
  @MaxLength(255)
  reason: string;

  @IsOptional()
  @IsString()
  forceRefund?: string;
}

export class AdminDispatchDto {
  // 指定保洁师；不传则由系统按得分自动选择
  @IsOptional()
  @IsString()
  staffId?: string;
}

export class AdminRefundQueryDto {
  @IsOptional()
  @IsString()
  status?: string;

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
  pageSize?: number = 20;
}

export class AdminApproveRefundDto {
  // 审批时可调整退款金额（单位：分）；不传则按退款单上的金额处理
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  amount?: number;
}

export class AdminCreateStaffDto {
  @IsString()
  @IsNotEmpty({ message: '请填写姓名' })
  @MaxLength(32)
  name: string;

  @IsString()
  @IsNotEmpty({ message: '请填写手机号' })
  @MaxLength(32)
  phone: string;

  // 保洁师登录用的 openid（开发阶段直接用登录码，如 staff_dev001）
  @IsString()
  @IsNotEmpty({ message: '请填写登录标识 openid' })
  @MaxLength(64)
  openid: string;

  @IsOptional()
  @IsArray()
  skillTags?: string[];

  @IsOptional()
  @IsArray()
  serviceDistricts?: string[];

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(20)
  maxDailyOrders?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100)
  settlementRate?: number;
}

export class AdminUpdateStaffDto {
  @IsOptional()
  @IsString()
  @MaxLength(32)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  phone?: string;

  @IsOptional()
  @IsArray()
  skillTags?: string[];

  @IsOptional()
  @IsArray()
  serviceDistricts?: string[];

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(20)
  maxDailyOrders?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100)
  settlementRate?: number;
}

export class AdminUpdateStaffStatusDto {
  // PENDING / ACTIVE / PAUSED / BANNED
  @IsString()
  @IsNotEmpty({ message: '请指定目标状态' })
  status: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  reason?: string;
}
