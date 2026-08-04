import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { CurrentUser, AuthedRequestUser } from "../common/decorators/current-user.decorator";
import { CartService } from "./cart.service";
import { AddItemDto } from "./dto/add-item.dto";
import { UpdateItemDto } from "./dto/update-item.dto";

@ApiTags("cart")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("cart")
export class CartController {
  constructor(private readonly cart: CartService) {}

  @Get()
  getCart(@CurrentUser() user: AuthedRequestUser) {
    return this.cart.getOrCreateCart(user.userId);
  }

  @Post("items")
  addItem(@CurrentUser() user: AuthedRequestUser, @Body() dto: AddItemDto) {
    return this.cart.addItem(user.userId, dto.variantId, dto.quantity);
  }

  @Patch("items/:itemId")
  updateItem(
    @CurrentUser() user: AuthedRequestUser,
    @Param("itemId") itemId: string,
    @Body() dto: UpdateItemDto,
  ) {
    return this.cart.updateItemQuantity(user.userId, itemId, dto.quantity);
  }

  @Delete("items/:itemId")
  removeItem(@CurrentUser() user: AuthedRequestUser, @Param("itemId") itemId: string) {
    return this.cart.removeItem(user.userId, itemId);
  }
}
