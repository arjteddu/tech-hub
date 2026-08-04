import { Body, Controller, Get, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { CurrentUser, AuthedRequestUser } from "../common/decorators/current-user.decorator";
import { AddressesService } from "./addresses.service";
import { CreateAddressDto } from "./dto/create-address.dto";

@ApiTags("addresses")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("addresses")
export class AddressesController {
  constructor(private readonly addresses: AddressesService) {}

  @Get()
  list(@CurrentUser() user: AuthedRequestUser) {
    return this.addresses.list(user.userId);
  }

  @Post()
  create(@CurrentUser() user: AuthedRequestUser, @Body() dto: CreateAddressDto) {
    return this.addresses.create(user.userId, dto);
  }
}
