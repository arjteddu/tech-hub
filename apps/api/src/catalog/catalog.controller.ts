import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { RolesGuard } from "../common/guards/roles.guard";
import { Roles } from "../common/decorators/roles.decorator";
import { CatalogService } from "./catalog.service";
import { CreateCategoryDto } from "./dto/create-category.dto";
import { CreateProductDto } from "./dto/create-product.dto";
import { UpdateProductStatusDto } from "./dto/update-product-status.dto";

@ApiTags("catalog")
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

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("ADMIN")
  @Post("categories")
  createCategory(@Body() dto: CreateCategoryDto) {
    return this.catalog.createCategory(dto);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("ADMIN")
  @Post("products")
  createProduct(@Body() dto: CreateProductDto) {
    return this.catalog.createProduct(dto);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("ADMIN")
  @Patch("products/:id/status")
  updateProductStatus(@Param("id") id: string, @Body() dto: UpdateProductStatusDto) {
    return this.catalog.updateProductStatus(id, dto.status);
  }
}
