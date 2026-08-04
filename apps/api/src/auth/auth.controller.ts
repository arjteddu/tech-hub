import { Body, Controller, HttpCode, Post } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { AuthService } from "./auth.service";
import { RegisterDto } from "./dto/register.dto";
import { LoginDto } from "./dto/login.dto";
import { RefreshDto } from "./dto/refresh.dto";
import { GuestCartId } from "../common/decorators/guest-cart-id.decorator";

@ApiTags("auth")
@Controller("auth")
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post("register")
  register(@Body() dto: RegisterDto, @GuestCartId() guestCartId?: string) {
    return this.auth.register(dto, guestCartId);
  }

  @Post("login")
  @HttpCode(200)
  login(@Body() dto: LoginDto, @GuestCartId() guestCartId?: string) {
    return this.auth.login(dto, guestCartId);
  }

  @Post("refresh")
  @HttpCode(200)
  refresh(@Body() dto: RefreshDto) {
    return this.auth.refresh(dto.refreshToken);
  }
}
