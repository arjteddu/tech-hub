import type { Order, OrderItem } from "db";
import type { OrderDto } from "shared";

type OrderWithItems = Order & { items: OrderItem[] };

export function toOrderDto(order: OrderWithItems): OrderDto {
  return {
    id: order.id,
    status: order.status,
    subtotal: order.subtotal.toString(),
    shipping: order.shipping.toString(),
    tax: order.tax.toString(),
    total: order.total.toString(),
    currency: order.currency,
    items: order.items.map((item) => ({
      id: item.id,
      variantId: item.variantId,
      quantity: item.quantity,
      unitPrice: item.unitPrice.toString(),
      productNameSnapshot: item.productNameSnapshot,
      variantNameSnapshot: item.variantNameSnapshot,
    })),
    createdAt: order.createdAt.toISOString(),
  };
}
