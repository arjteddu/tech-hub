import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import type { PrismaClient } from "db";
import { Prisma } from "db";
import type { CategoryDto, ProductDto, ProductListResponseDto } from "shared";
import { PRISMA } from "../prisma/prisma.module";
import { CacheService } from "../cache/cache.service";
import { CreateCategoryDto } from "./dto/create-category.dto";
import { CreateProductDto } from "./dto/create-product.dto";
import { toCategoryDto, toProductDto } from "./catalog.mapper";

const PAGE_SIZE = 24;
const CACHE_NAMESPACE = "catalog";
const LIST_TTL_SECONDS = 30;
const DETAIL_TTL_SECONDS = 60;
const CATEGORIES_TTL_SECONDS = 300;

@Injectable()
export class CatalogService {
  constructor(
    @Inject(PRISMA) private readonly prisma: PrismaClient,
    private readonly cache: CacheService,
  ) {}

  // Catalog pages are read far more than written — cache them so a
  // traffic spike hits Redis, not Postgres, and bump the namespace
  // version on any write below instead of hunting down individual keys.
  async listProducts(opts: {
    page?: number;
    categorySlug?: string;
    q?: string;
  }): Promise<ProductListResponseDto> {
    const page = Math.max(1, opts.page ?? 1);
    const cacheKey = `products:page=${page}:category=${opts.categorySlug ?? ""}:q=${opts.q ?? ""}`;

    return this.cache.getOrSet(CACHE_NAMESPACE, cacheKey, LIST_TTL_SECONDS, () =>
      opts.q
        ? this.searchProducts(opts.q, opts.categorySlug, page)
        : this.browseProducts(opts.categorySlug, page),
    );
  }

  /** No search term: plain filtered browse, newest first. */
  private async browseProducts(
    categorySlug: string | undefined,
    page: number,
  ): Promise<ProductListResponseDto> {
    const where = {
      status: "ACTIVE" as const,
      ...(categorySlug ? { category: { slug: categorySlug } } : {}),
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

    return {
      items: items.map(toProductDto),
      total,
      page,
      pageSize: PAGE_SIZE,
      pageCount: Math.ceil(total / PAGE_SIZE),
    };
  }

  /**
   * Ranked full-text search against the generated tsvector column.
   * $queryRaw does the ranking and pagination (Prisma's query builder has
   * no `@@`/ts_rank support), then a normal `findMany` hydrates the
   * relations for just those ids — two round trips, but the second one is
   * a primary-key lookup, not a second search.
   */
  private async searchProducts(
    q: string,
    categorySlug: string | undefined,
    page: number,
  ): Promise<ProductListResponseDto> {
    const categoryFilter = categorySlug
      ? Prisma.sql`AND c.slug = ${categorySlug}`
      : Prisma.empty;

    const ranked = await this.prisma.$queryRaw<{ id: string; total: bigint }[]>`
      SELECT p.id, count(*) OVER() AS total
      FROM products p
      LEFT JOIN categories c ON c.id = p."categoryId"
      WHERE p.status = 'ACTIVE'
        AND p.search_vector @@ plainto_tsquery('english', ${q})
        ${categoryFilter}
      ORDER BY ts_rank(p.search_vector, plainto_tsquery('english', ${q})) DESC
      LIMIT ${PAGE_SIZE} OFFSET ${(page - 1) * PAGE_SIZE}
    `;

    const total = ranked[0] ? Number(ranked[0].total) : 0;
    const ids = ranked.map((row) => row.id);
    const products = await this.prisma.product.findMany({
      where: { id: { in: ids } },
      include: { variants: true, category: true },
    });

    // findMany doesn't preserve `id: { in }` order, so re-sort by rank.
    const byId = new Map(products.map((p) => [p.id, p]));
    const items = ids.map((id) => byId.get(id)).filter((p) => p !== undefined);

    return {
      items: items.map(toProductDto),
      total,
      page,
      pageSize: PAGE_SIZE,
      pageCount: Math.ceil(total / PAGE_SIZE),
    };
  }

  async getProductBySlug(slug: string): Promise<ProductDto> {
    return this.cache.getOrSet(CACHE_NAMESPACE, `product:${slug}`, DETAIL_TTL_SECONDS, async () => {
      const product = await this.prisma.product.findUnique({
        where: { slug },
        include: { variants: true, category: true },
      });
      if (!product || product.status !== "ACTIVE") {
        throw new NotFoundException("Product not found");
      }
      return toProductDto(product);
    });
  }

  async listCategories(): Promise<CategoryDto[]> {
    return this.cache.getOrSet(CACHE_NAMESPACE, "categories", CATEGORIES_TTL_SECONDS, async () => {
      const categories = await this.prisma.category.findMany({ orderBy: { name: "asc" } });
      return categories.map(toCategoryDto);
    });
  }

  async createCategory(dto: CreateCategoryDto): Promise<CategoryDto> {
    const category = await this.prisma.category.create({ data: dto });
    await this.cache.bumpVersion(CACHE_NAMESPACE);
    return toCategoryDto(category);
  }

  async createProduct(dto: CreateProductDto): Promise<ProductDto> {
    const product = await this.prisma.product.create({
      data: {
        name: dto.name,
        slug: dto.slug,
        description: dto.description,
        categoryId: dto.categoryId,
        status: dto.status ?? "DRAFT",
        images: dto.images ?? [],
        variants: { create: dto.variants },
      },
      include: { variants: true, category: true },
    });
    await this.cache.bumpVersion(CACHE_NAMESPACE);
    return toProductDto(product);
  }

  async updateProductStatus(
    id: string,
    status: "DRAFT" | "ACTIVE" | "ARCHIVED",
  ): Promise<ProductDto> {
    const existing = await this.prisma.product.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException("Product not found");
    const product = await this.prisma.product.update({
      where: { id },
      data: { status },
      include: { variants: true, category: true },
    });
    await this.cache.bumpVersion(CACHE_NAMESPACE);
    return toProductDto(product);
  }
}
