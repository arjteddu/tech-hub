import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { ThrottlerModule, ThrottlerGuard } from "@nestjs/throttler";
import { APP_GUARD } from "@nestjs/core";
import { LoggerModule } from "nestjs-pino";
import { PrismaModule } from "./prisma/prisma.module";
import { QueueModule } from "./queue/queue.module";
import { RedisModule } from "./cache/redis.module";
import { HealthController } from "./health/health.controller";
import { AuthModule } from "./auth/auth.module";
import { CatalogModule } from "./catalog/catalog.module";
import { CartModule } from "./cart/cart.module";
import { OrdersModule } from "./orders/orders.module";
import { PaymentsModule } from "./payments/payments.module";
import { AddressesModule } from "./addresses/addresses.module";
import { MediaModule } from "./media/media.module";
import { envValidationSchema } from "./config/env.validation";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validationSchema: envValidationSchema }),
    LoggerModule.forRoot({
      pinoHttp: {
        level: process.env.LOG_LEVEL ?? "info",
        // Pretty-print in dev; ship raw JSON lines in prod for log aggregation.
        transport:
          process.env.NODE_ENV === "production" ? undefined : { target: "pino-pretty" },
        redact: ["req.headers.authorization"],
      },
    }),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 120 }]),
    PrismaModule,
    QueueModule,
    RedisModule,
    AuthModule,
    CatalogModule,
    CartModule,
    OrdersModule,
    PaymentsModule,
    AddressesModule,
    MediaModule,
  ],
  controllers: [HealthController],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
