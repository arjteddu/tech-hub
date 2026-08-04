import { Global, Module } from "@nestjs/common";
import { Queue } from "bullmq";
import { QUEUE_NAMES } from "shared";

export const ORDER_QUEUE = "ORDER_QUEUE";

const connection = {
  host: process.env.REDIS_HOST ?? "localhost",
  port: process.env.REDIS_PORT ? Number(process.env.REDIS_PORT) : 6379,
  password: process.env.REDIS_PASSWORD,
};

@Global()
@Module({
  providers: [
    {
      provide: ORDER_QUEUE,
      useFactory: () => new Queue(QUEUE_NAMES.ORDER_EVENTS, { connection }),
    },
  ],
  exports: [ORDER_QUEUE],
})
export class QueueModule {}
