import 'reflect-metadata';
import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';
import { API_PREFIX } from '@hc/shared';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { ResponseInterceptor } from './common/interceptors/response.interceptor';
import { verifyFileSignature } from './common/utils/file-url.util';

// Prisma 返回的 BigInt 无法被 JSON.stringify 直接处理，统一序列化为字符串
(BigInt.prototype as unknown as { toJSON: () => string }).toJSON = function (this: bigint) {
  return this.toString();
};

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // 上传文件需要签名才能访问：照片含用户家庭内景，禁止公开访问
  app.use('/uploads', (req: any, res: any, next: () => void) => {
    const filePath = String(req.originalUrl).split('?')[0];
    const isValid = verifyFileSignature(filePath, req.query?.exp, req.query?.sig);

    if (!isValid) {
      res.status(403).json({ code: 40300, message: '文件访问链接无效或已过期' });
      return;
    }

    next();
  });

  // 本地存储的静态目录（鉴权中间件在前，通过校验后才走到这里）
  app.useStaticAssets(join(process.cwd(), 'uploads'), { prefix: '/uploads/' });

  // 统一前缀：/api/v1
  app.setGlobalPrefix(API_PREFIX);

  // 参数校验：自动剔除未声明字段并转换类型
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: false,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  app.useGlobalInterceptors(new ResponseInterceptor());
  app.useGlobalFilters(new AllExceptionsFilter());
  app.enableCors();

  const port = Number(process.env.PORT ?? 3000);
  await app.listen(port);

  Logger.log(`服务已启动：http://localhost:${port}/${API_PREFIX}`, 'Bootstrap');
  Logger.log(`健康检查：http://localhost:${port}/${API_PREFIX}/health`, 'Bootstrap');
}

void bootstrap();
