import { randomBytes, scryptSync, timingSafeEqual } from 'crypto';

// 密码散列：salt:hash（使用 Node 内置 scrypt，无需额外依赖）
export function hashPassword(plain: string): string {
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(plain, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

export function verifyPassword(plain: string, stored: string): boolean {
  const [salt, hash] = (stored || '').split(':');
  if (!salt || !hash) {
    return false;
  }

  const computed = scryptSync(plain, salt, 64);
  const expected = Buffer.from(hash, 'hex');

  if (computed.length !== expected.length) {
    return false;
  }

  return timingSafeEqual(computed, expected);
}
