import { Injectable } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";

// Same JWT strategy as JwtAuthGuard, but never rejects the request — a
// missing or invalid token just leaves req.user undefined. Used on routes
// that behave differently for guests vs signed-in users (the cart) rather
// than routes that require auth outright.
@Injectable()
export class OptionalJwtAuthGuard extends AuthGuard("jwt") {
  handleRequest<TUser = unknown>(_err: unknown, user: unknown): TUser {
    return (user || undefined) as TUser;
  }
}
