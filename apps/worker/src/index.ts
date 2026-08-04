import { Worker, type Job } from "bullmq";
import { Resend } from "resend";
import { prisma } from "db";
import { QUEUE_NAMES, type OrderEventJob } from "shared";

const connection = {
  host: process.env.REDIS_HOST ?? "localhost",
  port: process.env.REDIS_PORT ? Number(process.env.REDIS_PORT) : 6379,
  password: process.env.REDIS_PASSWORD,
};

const resend = new Resend(process.env.RESEND_API_KEY);

async function handleOrderConfirmation(orderId: string) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { items: true, user: true },
  });
  if (!order) {
    console.warn(`order.confirmation: order ${orderId} not found, skipping`);
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
  console.log(`inventory.sync: variant ${variantId} changed`);
}

const worker = new Worker<OrderEventJob>(
  QUEUE_NAMES.ORDER_EVENTS,
  async (job: Job<OrderEventJob>) => {
    switch (job.data.type) {
      case "order.confirmation":
        return handleOrderConfirmation(job.data.orderId);
      case "inventory.sync":
        return handleInventorySync(job.data.variantId);
    }
  },
  { connection, concurrency: 5 },
);

worker.on("completed", (job) => console.log(`job ${job.id} (${job.name}) completed`));
worker.on("failed", (job, err) => console.error(`job ${job?.id} (${job?.name}) failed:`, err));

console.log("worker listening on queue:", QUEUE_NAMES.ORDER_EVENTS);
