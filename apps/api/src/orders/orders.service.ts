import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type { PrismaClient } from "db";
import { Prisma } from "db";
import { PRISMA } from "../prisma/prisma.module";

@Injectable()
export class OrdersService {
  constructor(@Inject(PRISMA) private readonly prisma: PrismaClient) {}

  /**
   * Reserves inventory and creates the order in a single transaction —
   * the one place in the system where correctness matters more than
   * latency. Inventory is decremented with a guarded update
   * (`inventoryQty >= quantity`), so two shoppers racing for the last
   * unit can't both succeed.
   */
  async createOrderFromCart(userId: string, addressId: string) {
    const address = await this.prisma.address.findFirst({
      where: { id: addressId, userId },
    });
    if (!address) throw new NotFoundException("Address not found");

    const cart = await this.prisma.cart.findUnique({
      where: { userId },
      include: { items: { include: { variant: { include: { product: true } } } } },
    });
    if (!cart || cart.items.length === 0) {
      throw new BadRequestException("Cart is empty");
    }

    return this.prisma.$transaction(async (tx) => {
      let subtotal = new Prisma.Decimal(0);

      for (const item of cart.items) {
        const result = await tx.productVariant.updateMany({
          where: { id: item.variantId, inventoryQty: { gte: item.quantity } },
          data: { inventoryQty: { decrement: item.quantity } },
        });
        if (result.count === 0) {
          throw new BadRequestException(
            `${item.variant.name} no longer has enough stock (wanted ${item.quantity})`,
          );
        }
        subtotal = subtotal.plus(item.variant.price.times(item.quantity));
      }

      const order = await tx.order.create({
        data: {
          userId,
          addressId,
          subtotal,
          shipping: new Prisma.Decimal(0),
          tax: new Prisma.Decimal(0),
          total: subtotal,
          items: {
            create: cart.items.map((item) => ({
              variantId: item.variantId,
              quantity: item.quantity,
              unitPrice: item.variant.price,
              productNameSnapshot: item.variant.product.name,
              variantNameSnapshot: item.variant.name,
            })),
          },
          inventoryLogs: {
            create: cart.items.map((item) => ({
              variantId: item.variantId,
              delta: -item.quantity,
              reason: "ORDER" as const,
            })),
          },
        },
        include: { items: true },
      });

      await tx.cartItem.deleteMany({ where: { cartId: cart.id } });

      return order;
    });
  }

  async listForUser(userId: string) {
    return this.prisma.order.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      include: { items: true, payment: true },
    });
  }

  async getForUser(userId: string, orderId: string) {
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, userId },
      include: { items: true, payment: true, address: true },
    });
    if (!order) throw new NotFoundException("Order not found");
    return order;
  }
}
