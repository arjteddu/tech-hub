import { BadRequestException, NotFoundException } from "@nestjs/common";
import { Prisma } from "db";
import { OrdersService } from "./orders.service";

function makeCartItem(overrides: Partial<{ variantId: string; quantity: number; price: string; name: string; productName: string }> = {}) {
  const price = new Prisma.Decimal(overrides.price ?? "80.00");
  return {
    variantId: overrides.variantId ?? "variant-1",
    quantity: overrides.quantity ?? 2,
    variant: {
      id: overrides.variantId ?? "variant-1",
      name: overrides.name ?? "Black",
      price,
      product: { name: overrides.productName ?? "Canvas Tote Bag" },
    },
  };
}

function makePrismaMock() {
  const tx = {
    productVariant: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
    order: {
      create: jest.fn().mockResolvedValue({
        id: "order-1",
        status: "PENDING_PAYMENT",
        subtotal: new Prisma.Decimal(0),
        shipping: new Prisma.Decimal(0),
        tax: new Prisma.Decimal(0),
        total: new Prisma.Decimal(0),
        currency: "INR",
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
        items: [],
      }),
    },
    cartItem: { deleteMany: jest.fn().mockResolvedValue({ count: 1 }) },
  };
  return {
    address: { findFirst: jest.fn() },
    cart: { findUnique: jest.fn() },
    $transaction: jest.fn((cb: (txArg: typeof tx) => unknown) => cb(tx)),
    __tx: tx, // exposed for assertions
  };
}

describe("OrdersService.createOrderFromCart", () => {
  it("throws NotFoundException when the address doesn't belong to the user", async () => {
    const prisma = makePrismaMock();
    prisma.address.findFirst.mockResolvedValue(null);

    const service = new OrdersService(prisma as any);
    await expect(service.createOrderFromCart("user-1", "addr-1")).rejects.toThrow(NotFoundException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("throws BadRequestException when the cart is empty", async () => {
    const prisma = makePrismaMock();
    prisma.address.findFirst.mockResolvedValue({ id: "addr-1", userId: "user-1" });
    prisma.cart.findUnique.mockResolvedValue({ id: "cart-1", items: [] });

    const service = new OrdersService(prisma as any);
    await expect(service.createOrderFromCart("user-1", "addr-1")).rejects.toThrow(BadRequestException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("rejects the whole order when a variant no longer has enough stock", async () => {
    const prisma = makePrismaMock();
    prisma.address.findFirst.mockResolvedValue({ id: "addr-1", userId: "user-1" });
    prisma.cart.findUnique.mockResolvedValue({
      id: "cart-1",
      items: [makeCartItem({ quantity: 5 })],
    });
    // Guarded update matches zero rows — the `inventoryQty >= quantity`
    // clause failed, meaning stock ran out between browse and checkout.
    prisma.__tx.productVariant.updateMany.mockResolvedValue({ count: 0 });

    const service = new OrdersService(prisma as any);
    await expect(service.createOrderFromCart("user-1", "addr-1")).rejects.toThrow(BadRequestException);
    expect(prisma.__tx.order.create).not.toHaveBeenCalled();
  });

  it("reserves inventory for every line item and computes the correct subtotal", async () => {
    const prisma = makePrismaMock();
    prisma.address.findFirst.mockResolvedValue({ id: "addr-1", userId: "user-1" });
    prisma.cart.findUnique.mockResolvedValue({
      id: "cart-1",
      items: [
        makeCartItem({ variantId: "v1", quantity: 2, price: "80.00", name: "Black" }),
        makeCartItem({ variantId: "v2", quantity: 1, price: "45.50", name: "Tan" }),
      ],
    });

    const service = new OrdersService(prisma as any);
    await service.createOrderFromCart("user-1", "addr-1");

    // Both variants get a guarded, quantity-decrementing update.
    expect(prisma.__tx.productVariant.updateMany).toHaveBeenNthCalledWith(1, {
      where: { id: "v1", inventoryQty: { gte: 2 } },
      data: { inventoryQty: { decrement: 2 } },
    });
    expect(prisma.__tx.productVariant.updateMany).toHaveBeenNthCalledWith(2, {
      where: { id: "v2", inventoryQty: { gte: 1 } },
      data: { inventoryQty: { decrement: 1 } },
    });

    // 2 * 80.00 + 1 * 45.50 = 205.50
    const orderCreateArgs = prisma.__tx.order.create.mock.calls[0][0];
    expect(orderCreateArgs.data.subtotal.toString()).toBe("205.5");
    expect(orderCreateArgs.data.total.toString()).toBe("205.5");
    expect(orderCreateArgs.data.items.create).toHaveLength(2);

    // The cart is cleared only after the order is successfully created.
    expect(prisma.__tx.cartItem.deleteMany).toHaveBeenCalledWith({ where: { cartId: "cart-1" } });
  });

  it("stops at the first out-of-stock item without reserving the rest", async () => {
    const prisma = makePrismaMock();
    prisma.address.findFirst.mockResolvedValue({ id: "addr-1", userId: "user-1" });
    prisma.cart.findUnique.mockResolvedValue({
      id: "cart-1",
      items: [
        makeCartItem({ variantId: "v1", quantity: 1 }),
        makeCartItem({ variantId: "v2", quantity: 1 }),
      ],
    });
    prisma.__tx.productVariant.updateMany
      .mockResolvedValueOnce({ count: 1 }) // v1 reserved fine
      .mockResolvedValueOnce({ count: 0 }); // v2 out of stock

    const service = new OrdersService(prisma as any);
    await expect(service.createOrderFromCart("user-1", "addr-1")).rejects.toThrow(BadRequestException);
    expect(prisma.__tx.productVariant.updateMany).toHaveBeenCalledTimes(2);
    expect(prisma.__tx.order.create).not.toHaveBeenCalled();
  });
});
