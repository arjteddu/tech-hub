import type { PrismaClient } from "db";
import type { Resend } from "resend";
import type { Logger } from "pino";

export interface HandlerDeps {
  prisma: PrismaClient;
  resend: Resend;
  logger: Logger;
}

// Split from index.ts (which wires up the real BullMQ Worker, Redis
// connection, and clients) so this business logic can be unit tested
// against mocked deps instead of a live queue.
export function createHandlers({ prisma, resend, logger }: HandlerDeps) {
  async function handleOrderConfirmation(orderId: string) {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { items: true, user: true },
    });
    if (!order) {
      logger.warn({ orderId }, "order.confirmation: order not found, skipping");
      return;
    }

    const lines = order.items
      .map((item) => `${item.quantity} x ${item.productNameSnapshot} (${item.variantNameSnapshot})`)
      .join("\n");

    // Resend's SDK returns { data, error } instead of throwing on API-level
    // failures (bad key, unverified domain) — check it explicitly, or a
    // rejected send silently reports the job as completed.
    const { error } = await resend.emails.send({
      from: process.env.ORDERS_FROM_EMAIL ?? "orders@example.com",
      to: order.user.email,
      subject: `Order confirmed — #${order.id.slice(-8)}`,
      text: `Thanks for your order!\n\n${lines}\n\nTotal: ${order.currency} ${order.total}`,
    });
    if (error) {
      throw new Error(`Resend rejected order confirmation email: ${error.message}`);
    }
  }

  async function handleInventorySync(variantId: string) {
    // Placeholder for syncing stock levels out to any external systems
    // (POS, marketplaces). Nothing external is wired up yet.
    logger.info({ variantId }, "inventory.sync: variant changed");
  }

  return { handleOrderConfirmation, handleInventorySync };
}
