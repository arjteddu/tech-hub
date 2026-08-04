import { BadRequestException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import type { PrismaClient } from "db";
import { PRISMA } from "../prisma/prisma.module";

@Injectable()
export class CartService {
  constructor(@Inject(PRISMA) private readonly prisma: PrismaClient) {}

  async getOrCreateCart(userId: string) {
    const cart = await this.prisma.cart.upsert({
      where: { userId },
      create: { userId },
      update: {},
      include: { items: { include: { variant: true } } },
    });
    return cart;
  }

  async addItem(userId: string, variantId: string, quantity: number) {
    if (quantity < 1) throw new BadRequestException("Quantity must be at least 1");

    const variant = await this.prisma.productVariant.findUnique({ where: { id: variantId } });
    if (!variant) throw new NotFoundException("Product variant not found");

    const cart = await this.prisma.cart.upsert({
      where: { userId },
      create: { userId },
      update: {},
    });

    await this.prisma.cartItem.upsert({
      where: { cartId_variantId: { cartId: cart.id, variantId } },
      create: { cartId: cart.id, variantId, quantity },
      update: { quantity: { increment: quantity } },
    });

    return this.getOrCreateCart(userId);
  }

  async updateItemQuantity(userId: string, itemId: string, quantity: number) {
    const cart = await this.getOrCreateCart(userId);
    const item = cart.items.find((i) => i.id === itemId);
    if (!item) throw new NotFoundException("Cart item not found");

    if (quantity < 1) {
      await this.prisma.cartItem.delete({ where: { id: itemId } });
    } else {
      await this.prisma.cartItem.update({ where: { id: itemId }, data: { quantity } });
    }
    return this.getOrCreateCart(userId);
  }

  async removeItem(userId: string, itemId: string) {
    return this.updateItemQuantity(userId, itemId, 0);
  }
}
