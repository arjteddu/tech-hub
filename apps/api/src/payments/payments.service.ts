import { BadRequestException, Inject, Injectable, Logger } from "@nestjs/common";
import Razorpay from "razorpay";
import * as crypto from "crypto";
import type { PrismaClient } from "db";
import type { CheckoutResponseDto, OrderDto } from "shared";
import { PRISMA } from "../prisma/prisma.module";
import { ORDER_QUEUE } from "../queue/queue.module";
import type { Queue } from "bullmq";

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);
  private readonly razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID as string,
    key_secret: process.env.RAZORPAY_KEY_SECRET as string,
  });

  constructor(
    @Inject(PRISMA) private readonly prisma: PrismaClient,
    @Inject(ORDER_QUEUE) private readonly orderQueue: Queue,
  ) {}

  /** Opens a Razorpay order against our local order and records it as CREATED. */
  async createRazorpayOrder(
    order: OrderDto,
  ): Promise<Omit<CheckoutResponseDto, "order">> {
    const amountPaise = Math.round(Number(order.total) * 100);

    const rpOrder = await this.razorpay.orders.create({
      amount: amountPaise,
      currency: order.currency,
      receipt: order.id,
    });

    await this.prisma.payment.create({
      data: {
        orderId: order.id,
        provider: "RAZORPAY",
        providerOrderId: rpOrder.id,
        status: "CREATED",
        amount: order.total,
        currency: order.currency,
      },
    });

    return {
      razorpayOrderId: rpOrder.id,
      razorpayKeyId: process.env.RAZORPAY_KEY_ID as string,
      amount: amountPaise,
      currency: order.currency,
    };
  }

  /**
   * Verifies the webhook signature against the RAW request body — never
   * the parsed JSON — then marks the order paid. This is the only place
   * an order is allowed to become PAID; a client-side redirect after
   * checkout is not proof anyone actually paid.
   */
  async handleWebhook(rawBody: Buffer, signature: string) {
    const expected = crypto
      .createHmac("sha256", process.env.RAZORPAY_WEBHOOK_SECRET as string)
      .update(rawBody)
      .digest("hex");

    if (expected !== signature) {
      this.logger.warn("Rejected webhook with invalid signature");
      throw new BadRequestException("Invalid webhook signature");
    }

    const event = JSON.parse(rawBody.toString("utf8"));

    if (event.event === "payment.captured") {
      const payload = event.payload.payment.entity;
      const payment = await this.prisma.payment.findFirst({
        where: { providerOrderId: payload.order_id },
      });
      if (!payment) {
        this.logger.warn(`Webhook for unknown order ${payload.order_id}`);
        return { ok: true };
      }

      await this.prisma.$transaction([
        this.prisma.payment.update({
          where: { id: payment.id },
          data: { status: "CAPTURED", providerPaymentId: payload.id, rawWebhookPayload: event },
        }),
        this.prisma.order.update({
          where: { id: payment.orderId },
          data: { status: "PAID" },
        }),
      ]);

      await this.orderQueue.add("order.confirmation", {
        type: "order.confirmation",
        orderId: payment.orderId,
      });
    }

    return { ok: true };
  }
}
