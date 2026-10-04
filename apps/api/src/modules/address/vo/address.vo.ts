import type { Address } from '@prisma/client';
import { maskPhone } from '../../../common/utils/mask.util';

export function toAddressVo(address: Address) {
  return {
    id: address.id.toString(),
    contactName: address.contactName,
    contactPhone: maskPhone(address.contactPhone),
    province: address.province,
    city: address.city,
    district: address.district,
    regionCode: address.regionCode,
    communityId: address.communityId?.toString() ?? null,
    detail: address.detail,
    lng: Number(address.lng),
    lat: Number(address.lat),
    floor: address.floor,
    hasElevator: address.hasElevator,
    tag: address.tag,
    isDefault: address.isDefault,
  };
}
