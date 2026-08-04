import { Worker, type Job } from "bullmq";
import { Resend } from "resend";
import pino from "pino";
import { prisma } from "db";
import { QUEUE_NAMES, type OrderEventJob } from "shared";
import { assertEnv } from "./env";
import { createHandlers } from "./handlers";

assertEnv();

const logger = pino(
  process.env.NODE_ENV === "production" ? {} : { transport: { target: "pino-pretty" } },
);

const connection = {
  host: process.env.REDIS_HOST ?? "localhost",
  port: process.env.REDIS_PORT ? Number(process.env.REDIS_PORT) : 6379,
  password: process.env.REDIS_PASSWORD,
};

const resend = new Resend(process.env.RESEND_API_KEY);
const { handleOrderConfirmation, handleInventorySync } = createHandlers({ prisma, resend, logger });

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

worker.on("completed", (job) => logger.info({ jobId: job.id, jobName: job.name }, "job completed"));
worker.on("failed", (job, err) =>
  logger.error({ jobId: job?.id, jobName: job?.name, err }, "job failed"),
);

logger.info({ queue: QUEUE_NAMES.ORDER_EVENTS }, "worker listening");
