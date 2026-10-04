import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CheckAreaDto } from './dto/check-area.dto';

@Injectable()
export class AreaService {
  constructor(private readonly prisma: PrismaService) {}

  /** 校验地址是否在服务范围内（行政区 + 小区双校验） */
  async check(dto: CheckAreaDto) {
    const region = await this.prisma.region.findFirst({
      where: { code: dto.districtCode, status: 1, deletedAt: null },
    });

    if (!region) {
      return { served: false, reason: 'NOT_FOUND', regionName: null, communityName: null };
    }

    if (!region.isServed) {
      return {
        served: false,
        reason: 'REGION_NOT_SERVED',
        regionName: region.name,
        communityName: null,
      };
    }

    if (dto.communityId) {
      const community = await this.prisma.community.findFirst({
        where: { id: BigInt(dto.communityId), status: 1, deletedAt: null },
      });

      if (!community) {
        return { served: false, reason: 'COMMUNITY_NOT_FOUND', regionName: region.name, communityName: null };
      }

      if (!community.isServed) {
        return {
          served: false,
          reason: 'COMMUNITY_NOT_SERVED',
          regionName: region.name,
          communityName: community.name,
        };
      }

      return {
        served: true,
        reason: 'OK',
        regionName: region.name,
        communityName: community.name,
      };
    }

    return { served: true, reason: 'OK', regionName: region.name, communityName: null };
  }
}
