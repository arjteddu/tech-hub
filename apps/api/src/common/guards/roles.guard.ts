import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { ROLES_KEY } from "../decorators/roles.decorator";
import type { AuthedRequestUser } from "../decorators/current-user.decorator";

// Runs after JwtAuthGuard — relies on req.user already being populated by
// the JWT strategy. Routes with no @Roles() metadata are left open to any
// authenticated user (JwtAuthGuard already gates that).
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<string[] | undefined>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required || required.length === 0) return true;

    const user: AuthedRequestUser = context.switchToHttp().getRequest().user;
    if (!required.includes(user.role)) {
      throw new ForbiddenException("You don't have permission to do that");
    }
    return true;
  }
}
