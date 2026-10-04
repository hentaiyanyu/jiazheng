import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class PrepayDto {
  @IsString()
  @IsNotEmpty({ message: 'outTradeNo 不能为空' })
  outTradeNo: string;
}

export class MockPayDto {
  @IsString()
  @IsNotEmpty({ message: 'outTradeNo 不能为空' })
  outTradeNo: string;
}

export class RefundDto {
  @IsString()
  @IsNotEmpty()
  orderNo: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  reason?: string;
}
