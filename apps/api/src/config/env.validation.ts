import { z } from 'zod';

/**
 * 环境变量校验：缺少关键配置时直接启动失败，避免带病运行。
 */
const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().default(3000),

    DATABASE_URL: z.string().min(1, 'DATABASE_URL 不能为空'),
    REDIS_URL: z.string().optional(),

    JWT_SECRET: z.string().min(8, 'JWT_SECRET 至少 8 位'),
    JWT_EXPIRES_IN: z.string().default('2h'),
    JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),

    WX_APPID: z.string().optional().default(''),
    WX_SECRET: z.string().optional().default(''),
    WX_MOCK: z.string().optional().default('true'),

    WXPAY_MCHID: z.string().optional().default(''),
    WXPAY_SERIAL_NO: z.string().optional().default(''),
    WXPAY_PRIVATE_KEY: z.string().optional().default(''),
    WXPAY_API_V3_KEY: z.string().optional().default(''),
    WXPAY_NOTIFY_URL: z.string().optional().default(''),

    TENCENT_MAP_KEY: z.string().optional().default(''),
  })
  .passthrough();

export function validateEnv(config: Record<string, unknown>): Record<string, unknown> {
  const result = envSchema.safeParse(config);

  if (!result.success) {
    const detail = result.error.issues
      .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
      .join('；');
    throw new Error(`环境变量校验失败 -> ${detail}`);
  }

  return result.data;
}
