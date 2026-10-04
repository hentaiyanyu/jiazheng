import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

/** 标记接口无需登录即可访问 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
