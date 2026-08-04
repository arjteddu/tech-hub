import { createParamDecorator, ExecutionContext } from "@nestjs/common";

export interface AuthedRequestUser {
  userId: string;
  role: string;
}

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthedRequestUser => {
    const request = ctx.switchToHttp().getRequest();
    return request.user;
  },
);

// For routes behind OptionalJwtAuthGuard, where an anonymous request is
// valid and req.user may genuinely be absent.
export const CurrentUserOptional = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthedRequestUser | undefined => {
    const request = ctx.switchToHttp().getRequest();
    return request.user;
  },
);
