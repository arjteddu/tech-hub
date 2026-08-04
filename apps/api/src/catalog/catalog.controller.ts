import { Controller, Get, Param, Query } from "@nestjs/common";
import { CatalogService } from "./catalog.service";

@Controller("catalog")
export class CatalogController {
  constructor(private readonly catalog: CatalogService) {}

  @Get("products")
  listProducts(
    @Query("page") page?: string,
    @Query("category") category?: string,
    @Query("q") q?: string,
  ) {
    return this.catalog.listProducts({
      page: page ? Number(page) : undefined,
      categorySlug: category,
      q,
    });
  }

  @Get("products/:slug")
  getProduct(@Param("slug") slug: string) {
    return this.catalog.getProductBySlug(slug);
  }

  @Get("categories")
  listCategories() {
    return this.catalog.listCategories();
  }
}
