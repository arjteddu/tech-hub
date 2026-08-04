import { createParamDecorator, ExecutionContext } from "@nestjs/common";

// The client generates this id itself and persists it (localStorage) for
// as long as the shopper is browsing without an account — it's how a
// stateless API tells one anonymous cart apart from another.
export const GuestCartId = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string | undefined => {
    const request = ctx.switchToHttp().getRequest();
    const header = request.headers["x-guest-cart-id"];
    return Array.isArray(header) ? header[0] : header;
  },
);
