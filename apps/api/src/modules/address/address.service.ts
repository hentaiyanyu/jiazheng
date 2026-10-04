import { Injectable } from '@nestjs/common';
import { ErrorCode } from '@hc/shared';
import { BizException } from '../../common/exceptions/biz.exception';
import { PrismaService } from '../../prisma/prisma.service';
import { SaveAddressDto } from './dto/address.dto';
import { toAddressVo } from './vo/address.vo';

@Injectable()
export class AddressService {
  constructor(private readonly prisma: PrismaService) {}

  async list(userId: bigint) {
    const list = await this.prisma.address.findMany({
      where: { userId, deletedAt: null },
      orderBy: [{ isDefault: 'desc' }, { id: 'desc' }],
    });
    return list.map(toAddressVo);
  }

  async findOwned(userId: bigint, addressId: bigint) {
    const address = await this.prisma.address.findFirst({
      where: { id: addressId, userId, deletedAt: null },
    });
    if (!address) {
      throw new BizException(ErrorCode.NOT_FOUND, '地址不存在');
    }
    return address;
  }

  async create(userId: bigint, dto: SaveAddressDto) {
    const count = await this.prisma.address.count({ where: { userId, deletedAt: null } });
    const shouldBeDefault = dto.isDefault === true || count === 0;

    return this.prisma.$transaction(async (tx) => {
      if (shouldBeDefault) {
        await tx.address.updateMany({
          where: { userId, isDefault: true, deletedAt: null },
          data: { isDefault: false },
        });
      }

      const address = await tx.address.create({
        data: {
          userId,
          contactName: dto.contactName,
          contactPhone: dto.contactPhone,
          province: dto.province,
          city: dto.city,
          district: dto.district,
          regionCode: dto.regionCode,
          communityId: dto.communityId ? BigInt(dto.communityId) : null,
          detail: dto.detail,
          lng: dto.lng,
          lat: dto.lat,
          floor: dto.floor ?? 1,
          hasElevator: dto.hasElevator ?? true,
          tag: dto.tag ?? null,
          isDefault: shouldBeDefault,
        },
      });

      return toAddressVo(address);
    });
  }

  async update(userId: bigint, addressId: bigint, dto: SaveAddressDto) {
    await this.findOwned(userId, addressId);

    return this.prisma.$transaction(async (tx) => {
      if (dto.isDefault === true) {
        await tx.address.updateMany({
          where: { userId, isDefault: true, deletedAt: null },
          data: { isDefault: false },
        });
      }

      const address = await tx.address.update({
        where: { id: addressId },
        data: {
          contactName: dto.contactName,
          contactPhone: dto.contactPhone,
          province: dto.province,
          city: dto.city,
          district: dto.district,
          regionCode: dto.regionCode,
          communityId: dto.communityId ? BigInt(dto.communityId) : null,
          detail: dto.detail,
          lng: dto.lng,
          lat: dto.lat,
          floor: dto.floor ?? 1,
          hasElevator: dto.hasElevator ?? true,
          tag: dto.tag ?? null,
          ...(dto.isDefault === undefined ? {} : { isDefault: dto.isDefault }),
        },
      });

      return toAddressVo(address);
    });
  }

  /** 软删除；若删除的是默认地址，自动把最新的一条设为默认 */
  async remove(userId: bigint, addressId: bigint) {
    const address = await this.findOwned(userId, addressId);

    await this.prisma.$transaction(async (tx) => {
      await tx.address.update({
        where: { id: addressId },
        data: { deletedAt: new Date(), isDefault: false },
      });

      if (address.isDefault) {
        const next = await tx.address.findFirst({
          where: { userId, deletedAt: null },
          orderBy: { id: 'desc' },
        });
        if (next) {
          await tx.address.update({ where: { id: next.id }, data: { isDefault: true } });
        }
      }
    });

    return { deleted: true };
  }

  async setDefault(userId: bigint, addressId: bigint) {
    await this.findOwned(userId, addressId);

    await this.prisma.$transaction([
      this.prisma.address.updateMany({
        where: { userId, isDefault: true, deletedAt: null },
        data: { isDefault: false },
      }),
      this.prisma.address.update({ where: { id: addressId }, data: { isDefault: true } }),
    ]);

    return { isDefault: true };
  }
}
