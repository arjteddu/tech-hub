import { Body, Controller, Get, Param, Post, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { CurrentUser, AuthedRequestUser } from "../common/decorators/current-user.decorator";
import { OrdersService } from "./orders.service";
import { PaymentsService } from "../payments/payments.service";
import { CheckoutDto } from "./dto/checkout.dto";

@UseGuards(JwtAuthGuard)
@Controller("orders")
export class OrdersController {
  constructor(
    private readonly orders: OrdersService,
    private readonly payments: PaymentsService,
  ) {}

  @Get()
  list(@CurrentUser() user: AuthedRequestUser) {
    return this.orders.listForUser(user.userId);
  }

  @Get(":id")
  get(@CurrentUser() user: AuthedRequestUser, @Param("id") id: string) {
    return this.orders.getForUser(user.userId, id);
  }

  // Reserves inventory + creates the order, then opens a Razorpay order
  // against it. The order stays PENDING_PAYMENT until the webhook confirms
  // payment — this endpoint never marks anything paid itself.
  @Post("checkout")
  async checkout(@CurrentUser() user: AuthedRequestUser, @Body() dto: CheckoutDto) {
    const order = await this.orders.createOrderFromCart(user.userId, dto.addressId);
    const razorpay = await this.payments.createRazorpayOrder(order);
    return { order, ...razorpay };
  }
}
