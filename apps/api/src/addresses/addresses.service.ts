import { Inject, Injectable } from "@nestjs/common";
import type { PrismaClient } from "db";
import { PRISMA } from "../prisma/prisma.module";
import { CreateAddressDto } from "./dto/create-address.dto";

@Injectable()
export class AddressesService {
  constructor(@Inject(PRISMA) private readonly prisma: PrismaClient) {}

  list(userId: string) {
    return this.prisma.address.findMany({ where: { userId }, orderBy: { createdAt: "desc" } });
  }

  create(userId: string, dto: CreateAddressDto) {
    return this.prisma.address.create({ data: { userId, country: "IN", ...dto } });
  }
}
