/** 手机号脱敏：138****1234 */
export function maskPhone(phone?: string | null): string | null {
  if (!phone || phone.length < 7) {
    return phone ?? null;
  }
  return `${phone.slice(0, 3)}****${phone.slice(-4)}`;
}
