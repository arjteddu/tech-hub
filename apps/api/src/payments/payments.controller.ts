import {
  BadRequestException,
  Controller,
  Headers,
  HttpCode,
  Post,
  Req,
  type RawBodyRequest,
} from "@nestjs/common";
import type { Request } from "express";
import { PaymentsService } from "./payments.service";

@Controller("payments")
export class PaymentsController {
  constructor(private readonly payments: PaymentsService) {}

  // Razorpay calls this directly — no auth guard, trust is established by
  // verifying the HMAC signature against the raw body instead.
  @Post("webhook")
  @HttpCode(200)
  async webhook(
    @Req() req: RawBodyRequest<Request>,
    @Headers("x-razorpay-signature") signature?: string,
  ) {
    if (!signature || !req.rawBody) {
      throw new BadRequestException("Missing signature or body");
    }
    return this.payments.handleWebhook(req.rawBody, signature);
  }
}
