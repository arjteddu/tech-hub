import { Controller, Get, Inject } from "@nestjs/common";
import { PRISMA } from "../prisma/prisma.module";
import type { PrismaClient } from "db";

@Controller("health")
export class HealthController {
  constructor(@Inject(PRISMA) private readonly prisma: PrismaClient) {}

  @Get()
  async check() {
    await this.prisma.$queryRaw`SELECT 1`;
    return { status: "ok", time: new Date().toISOString() };
  }
}
