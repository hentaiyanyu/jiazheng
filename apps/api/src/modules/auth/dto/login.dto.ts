import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class LoginDto {
  /** wx.login() 返回的临时登录凭证 */
  @IsString()
  @IsNotEmpty({ message: 'code 不能为空' })
  @MaxLength(256)
  code: string;
}
