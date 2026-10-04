import { Body, Controller, Delete, Get, HttpCode, Param, Post, Put } from '@nestjs/common';
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator';
import { AddressService } from './address.service';
import { SaveAddressDto } from './dto/address.dto';

@Controller('addresses')
export class AddressController {
  constructor(private readonly addressService: AddressService) {}

  @Get()
  list(@CurrentUser() user: JwtPayload) {
    return this.addressService.list(BigInt(user.sub));
  }

  @Post()
  @HttpCode(200)
  create(@CurrentUser() user: JwtPayload, @Body() dto: SaveAddressDto) {
    return this.addressService.create(BigInt(user.sub), dto);
  }

  @Put(':id')
  update(@CurrentUser() user: JwtPayload, @Param('id') id: string, @Body() dto: SaveAddressDto) {
    return this.addressService.update(BigInt(user.sub), BigInt(id), dto);
  }

  @Delete(':id')
  remove(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.addressService.remove(BigInt(user.sub), BigInt(id));
  }

  @Post(':id/default')
  @HttpCode(200)
  setDefault(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.addressService.setDefault(BigInt(user.sub), BigInt(id));
  }
}
