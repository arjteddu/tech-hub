import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import type { PrismaClient } from "db";
import { PRISMA } from "../prisma/prisma.module";

const PAGE_SIZE = 24;

@Injectable()
export class CatalogService {
  constructor(@Inject(PRISMA) private readonly prisma: PrismaClient) {}

  async listProducts(opts: { page?: number; categorySlug?: string; q?: string }) {
    const page = Math.max(1, opts.page ?? 1);

    const where = {
      status: "ACTIVE" as const,
      ...(opts.categorySlug ? { category: { slug: opts.categorySlug } } : {}),
      // Naive substring search to start. Once the tsvector + GIN index
      // migration lands (see schema.prisma), swap this for a ranked
      // full-text query — same shape, better relevance at catalog size.
      ...(opts.q
        ? { OR: [{ name: { contains: opts.q, mode: "insensitive" as const } }] }
        : {}),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.product.findMany({
        where,
        include: { variants: true, category: true },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * PAGE_SIZE,
        take: PAGE_SIZE,
      }),
      this.prisma.product.count({ where }),
    ]);

    return { items, total, page, pageSize: PAGE_SIZE, pageCount: Math.ceil(total / PAGE_SIZE) };
  }

  async getProductBySlug(slug: string) {
    const product = await this.prisma.product.findUnique({
      where: { slug },
      include: { variants: true, category: true },
    });
    if (!product || product.status !== "ACTIVE") {
      throw new NotFoundException("Product not found");
    }
    return product;
  }

  listCategories() {
    return this.prisma.category.findMany({ orderBy: { name: "asc" } });
  }
}
