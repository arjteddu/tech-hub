import {
  ConflictException,
  Inject,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import * as bcrypt from "bcryptjs";
import type { PrismaClient } from "db";
import type { AuthResponseDto, AuthUserDto } from "shared";
import { PRISMA } from "../prisma/prisma.module";
import { RegisterDto } from "./dto/register.dto";
import { LoginDto } from "./dto/login.dto";
import { CartService } from "../cart/cart.service";

const ACCESS_TOKEN_TTL = "15m";
const REFRESH_TOKEN_TTL = "30d";

@Injectable()
export class AuthService {
  constructor(
    @Inject(PRISMA) private readonly prisma: PrismaClient,
    private readonly jwt: JwtService,
    private readonly cart: CartService,
  ) {}

  private signTokens(userId: string, role: string) {
    const payload = { sub: userId, role };
    return {
      accessToken: this.jwt.sign(payload, {
        secret: process.env.JWT_ACCESS_SECRET,
        expiresIn: ACCESS_TOKEN_TTL,
      }),
      refreshToken: this.jwt.sign(payload, {
        secret: process.env.JWT_REFRESH_SECRET,
        expiresIn: REFRESH_TOKEN_TTL,
      }),
    };
  }

  async register(dto: RegisterDto, guestCartId?: string): Promise<AuthResponseDto> {
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (existing) {
      throw new ConflictException("An account with this email already exists");
    }

    const passwordHash = await bcrypt.hash(dto.password, 12);
    const user = await this.prisma.user.create({
      data: { email: dto.email, passwordHash, name: dto.name },
    });

    if (guestCartId) await this.cart.mergeGuestCartIntoUserCart(user.id, guestCartId);

    return { user: this.publicUser(user), ...this.signTokens(user.id, user.role) };
  }

  async login(dto: LoginDto, guestCartId?: string): Promise<AuthResponseDto> {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (!user?.passwordHash || !(await bcrypt.compare(dto.password, user.passwordHash))) {
      throw new UnauthorizedException("Invalid email or password");
    }

    if (guestCartId) await this.cart.mergeGuestCartIntoUserCart(user.id, guestCartId);

    return { user: this.publicUser(user), ...this.signTokens(user.id, user.role) };
  }

  async refresh(refreshToken: string) {
    let payload: { sub: string; role: string };
    try {
      payload = this.jwt.verify(refreshToken, {
        secret: process.env.JWT_REFRESH_SECRET,
      });
    } catch {
      throw new UnauthorizedException("Invalid or expired refresh token");
    }

    const user = await this.prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user) throw new UnauthorizedException("User no longer exists");

    return this.signTokens(user.id, user.role);
  }

  private publicUser(user: {
    id: string;
    email: string;
    name: string | null;
    role: string;
  }): AuthUserDto {
    return { id: user.id, email: user.email, name: user.name, role: user.role as AuthUserDto["role"] };
  }
}
