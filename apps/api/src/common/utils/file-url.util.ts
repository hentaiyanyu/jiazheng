import { createHmac, timingSafeEqual } from 'crypto';

/**
 * 上传文件的签名访问
 *
 * 服务照片包含用户家庭内景，属于敏感内容，不能公开访问。
 * 做法：返回给前端的地址带一个有效期签名（HMAC），
 * 访问时校验签名与有效期，过期或被篡改都打不开。
 *
 * 注意：小程序 <image> 无法自定义请求头，所以不能用 token 鉴权，
 * 签名链接是这类场景的标准做法。
 */

// 签名有效期（秒）
const DEFAULT_TTL_SECONDS = 2 * 60 * 60;

function getSecret(): string {
  return process.env.FILE_URL_SECRET || process.env.JWT_SECRET || 'dev-file-url-secret';
}

function buildSignature(filePath: string, exp: number): string {
  return createHmac('sha256', getSecret()).update(`${filePath}:${exp}`).digest('hex');
}

/** 为上传文件生成带签名的访问地址；非本地上传地址原样返回 */
export function signFileUrl(filePath?: string | null, ttlSeconds = DEFAULT_TTL_SECONDS): string {
  if (!filePath) {
    return '';
  }

  // 只处理本站上传的路径，外部地址与已签名地址不动
  if (filePath.indexOf('/uploads/') !== 0 || filePath.indexOf('?') >= 0) {
    return filePath;
  }

  const exp = Math.floor(Date.now() / 1000) + ttlSeconds;
  return `${filePath}?exp=${exp}&sig=${buildSignature(filePath, exp)}`;
}

/** 校验签名是否有效（含过期判断） */
export function verifyFileSignature(filePath: string, exp?: string, sig?: string): boolean {
  if (!exp || !sig) {
    return false;
  }

  const expireAt = Number(exp);
  if (!Number.isFinite(expireAt) || expireAt * 1000 < Date.now()) {
    return false;
  }

  const expected = buildSignature(filePath, expireAt);
  const expectedBuffer = Buffer.from(expected);
  const actualBuffer = Buffer.from(sig);

  if (expectedBuffer.length !== actualBuffer.length) {
    return false;
  }

  return timingSafeEqual(expectedBuffer, actualBuffer);
}
