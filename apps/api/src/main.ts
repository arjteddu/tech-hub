import "./instrument"; // must be first: Sentry has to init before anything it instruments loads
import "reflect-metadata";
import { HttpAdapterHost, NestFactory } from "@nestjs/core";
import { ValidationPipe } from "@nestjs/common";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { Logger } from "nestjs-pino";
import { AppModule } from "./app.module";
import { SentryExceptionFilter } from "./common/filters/sentry-exception.filter";

async function bootstrap() {
  // rawBody: true keeps the untouched request buffer around (on
  // req.rawBody) so the payments webhook can verify Razorpay's HMAC
  // signature against exactly the bytes they signed, not our parsed JSON.
  // bufferLogs: true holds startup log lines until the pino logger below
  // takes over, so nothing gets lost or printed with Nest's default logger.
  const app = await NestFactory.create(AppModule, { rawBody: true, bufferLogs: true });
  app.useLogger(app.get(Logger));

  app.enableCors({
    origin: process.env.WEB_ORIGIN?.split(",") ?? ["http://localhost:3000"],
    credentials: true,
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );
  app.setGlobalPrefix("api");

  const { httpAdapter } = app.get(HttpAdapterHost);
  app.useGlobalFilters(new SentryExceptionFilter(httpAdapter));

  const swaggerDoc = SwaggerModule.createDocument(
    app,
    new DocumentBuilder()
      .setTitle("tech-hub API")
      .setDescription("Storefront API — catalog, cart, checkout, payments")
      .setVersion("1.0")
      .addBearerAuth()
      .build(),
  );
  SwaggerModule.setup("api/docs", app, swaggerDoc);

  const port = process.env.PORT ? Number(process.env.PORT) : 4000;
  await app.listen(port);
  app.get(Logger).log(`api listening on :${port}`, "Bootstrap");
}

bootstrap();
