import { BadRequestException, Inject, Injectable, Logger, NotFoundException } from "@nestjs/common";
import type { PrismaClient } from "db";
import type Redis from "ioredis";
import type { CartDto } from "shared";
import { PRISMA } from "../prisma/prisma.module";
import { REDIS } from "../cache/redis.token";
import { toCartDto } from "./cart.mapper";
import { toVariantDto } from "../catalog/catalog.mapper";

const GUEST_CART_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 days

@Injectable()
export class CartService {
  private readonly logger = new Logger(CartService.name);

  constructor(
    @Inject(PRISMA) private readonly prisma: PrismaClient,
    @Inject(REDIS) private readonly redis: Redis,
  ) {}

  // ---------------------------------------------------------------------
  // Signed-in shoppers: cart lives in Postgres.
  // ---------------------------------------------------------------------

  async getOrCreateCart(userId: string): Promise<CartDto> {
    const cart = await this.prisma.cart.upsert({
      where: { userId },
      create: { userId },
      update: {},
      include: { items: { include: { variant: true } } },
    });
    return toCartDto(cart);
  }

  async addItem(userId: string, variantId: string, quantity: number): Promise<CartDto> {
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

  async updateItemQuantity(userId: string, itemId: string, quantity: number): Promise<CartDto> {
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

  async removeItem(userId: string, itemId: string): Promise<CartDto> {
    return this.updateItemQuantity(userId, itemId, 0);
  }

  // ---------------------------------------------------------------------
  // Anonymous shoppers: cart is a variantId -> quantity map in Redis,
  // keyed by a client-generated id. There's no row id to speak of, so the
  // variant id doubles as the "item id" — that keeps the update/remove
  // endpoints identical in shape to the signed-in path.
  // ---------------------------------------------------------------------

  async getGuestCart(guestId: string): Promise<CartDto> {
    const quantities = await this.readGuestQuantities(guestId);
    return this.hydrateGuestCart(guestId, quantities);
  }

  async addGuestItem(guestId: string, variantId: string, quantity: number): Promise<CartDto> {
    if (quantity < 1) throw new BadRequestException("Quantity must be at least 1");

    const variant = await this.prisma.productVariant.findUnique({ where: { id: variantId } });
    if (!variant) throw new NotFoundException("Product variant not found");

    const quantities = await this.readGuestQuantities(guestId);
    quantities[variantId] = (quantities[variantId] ?? 0) + quantity;
    await this.writeGuestQuantities(guestId, quantities);
    return this.hydrateGuestCart(guestId, quantities);
  }

  async updateGuestItemQuantity(guestId: string, variantId: string, quantity: number): Promise<CartDto> {
    const quantities = await this.readGuestQuantities(guestId);
    if (quantity < 1) {
      delete quantities[variantId];
    } else {
      quantities[variantId] = quantity;
    }
    await this.writeGuestQuantities(guestId, quantities);
    return this.hydrateGuestCart(guestId, quantities);
  }

  async removeGuestItem(guestId: string, variantId: string): Promise<CartDto> {
    return this.updateGuestItemQuantity(guestId, variantId, 0);
  }

  /** Folds a guest cart into the user's DB cart once, then clears it — called right after login/register. */
  async mergeGuestCartIntoUserCart(userId: string, guestId: string): Promise<void> {
    const quantities = await this.readGuestQuantities(guestId);
    for (const [variantId, quantity] of Object.entries(quantities)) {
      try {
        await this.addItem(userId, variantId, quantity);
      } catch (err) {
        // A variant could have been archived or deleted since it was
        // added anonymously — skip it rather than fail the whole login.
        this.logger.warn(`could not merge guest cart item ${variantId} for user ${userId}`, err as Error);
      }
    }
    await this.redis.del(this.guestKey(guestId));
  }

  private guestKey(guestId: string) {
    return `guest-cart:${guestId}`;
  }

  private async readGuestQuantities(guestId: string): Promise<Record<string, number>> {
    const raw = await this.redis.get(this.guestKey(guestId));
    return raw ? JSON.parse(raw) : {};
  }

  private async writeGuestQuantities(guestId: string, quantities: Record<string, number>): Promise<void> {
    await this.redis.set(this.guestKey(guestId), JSON.stringify(quantities), "EX", GUEST_CART_TTL_SECONDS);
  }

  private async hydrateGuestCart(guestId: string, quantities: Record<string, number>): Promise<CartDto> {
    const variantIds = Object.keys(quantities);
    if (variantIds.length === 0) return { id: `guest:${guestId}`, items: [] };

    const variants = await this.prisma.productVariant.findMany({ where: { id: { in: variantIds } } });
    return {
      id: `guest:${guestId}`,
      items: variants.map((variant) => ({
        id: variant.id,
        variantId: variant.id,
        quantity: quantities[variant.id],
        variant: toVariantDto(variant),
      })),
    };
  }
}
