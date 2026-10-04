import {
  BadRequestException,
  Controller,
  HttpCode,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { randomUUID } from 'crypto';
import { promises as fs } from 'fs';
import { join } from 'path';

const ALLOWED_MIME: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

// 文件上传
//
// 开发阶段落本地磁盘（apps/api/uploads），生产环境建议改为腾讯云 COS 直传，
// 只需替换本控制器的实现，前端调用方式不变。
@Controller('uploads')
export class UploadController {
  @Post()
  @HttpCode(200)
  @UseInterceptors(FileInterceptor('file'))
  async upload(@UploadedFile() file: any) {
    if (!file || !file.buffer) {
      throw new BadRequestException('请选择要上传的文件');
    }

    const ext = ALLOWED_MIME[file.mimetype];
    if (!ext) {
      throw new BadRequestException('仅支持 jpg / png / webp 图片');
    }

    if (file.size > 5 * 1024 * 1024) {
      throw new BadRequestException('图片不能超过 5MB');
    }

    const now = new Date();
    const year = String(now.getFullYear());
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const dir = join(process.cwd(), 'uploads', year, month);

    await fs.mkdir(dir, { recursive: true });

    const filename = `${randomUUID()}.${ext}`;
    await fs.writeFile(join(dir, filename), file.buffer);

    return {
      url: `/uploads/${year}/${month}/${filename}`,
      size: file.size,
    };
  }
}
