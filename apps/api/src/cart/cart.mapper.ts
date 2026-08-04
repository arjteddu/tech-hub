import type { Cart, CartItem, ProductVariant } from "db";
import type { CartDto } from "shared";
import { toVariantDto } from "../catalog/catalog.mapper";

type CartWithItems = Cart & { items: (CartItem & { variant: ProductVariant })[] };

export function toCartDto(cart: CartWithItems): CartDto {
  return {
    id: cart.id,
    items: cart.items.map((item) => ({
      id: item.id,
      variantId: item.variantId,
      quantity: item.quantity,
      variant: toVariantDto(item.variant),
    })),
  };
}
