import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class BindPhoneDto {
  /** 微信 getPhoneNumber 返回的 code，Sprint 1 起调用微信接口换取真实手机号 */
  @IsString()
  @IsNotEmpty({ message: 'code 不能为空' })
  @MaxLength(256)
  code: string;
}
