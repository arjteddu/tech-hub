import { BadRequestException, Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { OptionalJwtAuthGuard } from "../common/guards/optional-jwt-auth.guard";
import { CurrentUserOptional, AuthedRequestUser } from "../common/decorators/current-user.decorator";
import { GuestCartId } from "../common/decorators/guest-cart-id.decorator";
import { CartService } from "./cart.service";
import { AddItemDto } from "./dto/add-item.dto";
import { UpdateItemDto } from "./dto/update-item.dto";

// Works for both signed-in users (DB cart) and anonymous shoppers (Redis
// cart, identified by the X-Guest-Cart-Id header the client generates and
// persists itself). OptionalJwtAuthGuard means an Authorization header is
// used when present but never required here.
@ApiTags("cart")
@ApiBearerAuth()
@UseGuards(OptionalJwtAuthGuard)
@Controller("cart")
export class CartController {
  constructor(private readonly cart: CartService) {}

  @Get()
  getCart(@CurrentUserOptional() user: AuthedRequestUser | undefined, @GuestCartId() guestId?: string) {
    if (user) return this.cart.getOrCreateCart(user.userId);
    if (!guestId) return { id: "guest:none", items: [] };
    return this.cart.getGuestCart(guestId);
  }

  @Post("items")
  addItem(
    @CurrentUserOptional() user: AuthedRequestUser | undefined,
    @GuestCartId() guestId: string | undefined,
    @Body() dto: AddItemDto,
  ) {
    if (user) return this.cart.addItem(user.userId, dto.variantId, dto.quantity);
    if (!guestId) throw new BadRequestException("Missing X-Guest-Cart-Id header");
    return this.cart.addGuestItem(guestId, dto.variantId, dto.quantity);
  }

  @Patch("items/:itemId")
  updateItem(
    @CurrentUserOptional() user: AuthedRequestUser | undefined,
    @GuestCartId() guestId: string | undefined,
    @Param("itemId") itemId: string,
    @Body() dto: UpdateItemDto,
  ) {
    if (user) return this.cart.updateItemQuantity(user.userId, itemId, dto.quantity);
    if (!guestId) throw new BadRequestException("Missing X-Guest-Cart-Id header");
    // For a guest cart, itemId is the variantId (see CartService).
    return this.cart.updateGuestItemQuantity(guestId, itemId, dto.quantity);
  }

  @Delete("items/:itemId")
  removeItem(
    @CurrentUserOptional() user: AuthedRequestUser | undefined,
    @GuestCartId() guestId: string | undefined,
    @Param("itemId") itemId: string,
  ) {
    if (user) return this.cart.removeItem(user.userId, itemId);
    if (!guestId) throw new BadRequestException("Missing X-Guest-Cart-Id header");
    return this.cart.removeGuestItem(guestId, itemId);
  }
}
