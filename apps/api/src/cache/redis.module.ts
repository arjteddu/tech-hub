import { Global, Module } from "@nestjs/common";
import Redis from "ioredis";
import { CacheService } from "./cache.service";
import { REDIS } from "./redis.token";

@Global()
@Module({
  providers: [
    {
      provide: REDIS,
      useFactory: () =>
        new Redis({
          host: process.env.REDIS_HOST ?? "localhost",
          port: process.env.REDIS_PORT ? Number(process.env.REDIS_PORT) : 6379,
          password: process.env.REDIS_PASSWORD,
          // BullMQ's own Queue/Worker manage their own connections; this
          // client is strictly for caching, so it can be lazy and won't
          // block boot if Redis is briefly unavailable.
          lazyConnect: false,
          maxRetriesPerRequest: 2,
        }),
    },
    CacheService,
  ],
  exports: [REDIS, CacheService],
})
export class RedisModule {}
