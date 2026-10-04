import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ErrorCode } from '@hc/shared';
import { BizException } from '../../common/exceptions/biz.exception';

export interface WechatSession {
  openid: string;
  unionid?: string;
  sessionKey?: string;
}

@Injectable()
export class WechatService {
  private readonly logger = new Logger(WechatService.name);

  constructor(private readonly config: ConfigService) {}

  /**
   * 用 wx.login 的 code 换取 openid。
   * 未配置 AppID/Secret 或 WX_MOCK=true 时走本地模拟，方便在没有小程序账号时开发。
   */
  async code2session(code: string): Promise<WechatSession> {
    const mock = (this.config.get<string>('WX_MOCK') ?? 'true') !== 'false';

    if (mock) {
      this.logger.warn(`[Mock 登录] code=${code} -> openid=mock_openid_${code}`);
      return { openid: `mock_openid_${code}` };
    }

    const appid = this.config.get<string>('WX_APPID');
    const secret = this.config.get<string>('WX_SECRET');

    if (!appid || !secret) {
      throw new BizException(ErrorCode.WX_LOGIN_FAILED, '未配置微信 AppID / Secret');
    }

    const url =
      'https://api.weixin.qq.com/sns/jscode2session' +
      `?appid=${encodeURIComponent(appid)}` +
      `&secret=${encodeURIComponent(secret)}` +
      `&js_code=${encodeURIComponent(code)}` +
      '&grant_type=authorization_code';

    try {
      const response = await fetch(url);
      const data = (await response.json()) as Record<string, any>;

      if (!data.openid) {
        this.logger.error(`微信登录失败：${JSON.stringify(data)}`);
        throw new BizException(ErrorCode.WX_LOGIN_FAILED, data.errmsg ?? '微信登录失败');
      }

      return {
        openid: data.openid,
        unionid: data.unionid,
        sessionKey: data.session_key,
      };
    } catch (error) {
      if (error instanceof BizException) {
        throw error;
      }
      this.logger.error(`调用微信接口异常：${(error as Error).message}`);
      throw new BizException(ErrorCode.THIRD_PARTY_ERROR, '微信服务暂时不可用，请稍后重试');
    }
  }
}
