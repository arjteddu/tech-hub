import type { Category, Product, ProductVariant } from "db";
import type { CategoryDto, ProductDto, ProductVariantDto } from "shared";

export function toCategoryDto(c: Category): CategoryDto {
  return { id: c.id, name: c.name, slug: c.slug, parentId: c.parentId };
}

export function toVariantDto(v: ProductVariant): ProductVariantDto {
  return {
    id: v.id,
    productId: v.productId,
    sku: v.sku,
    name: v.name,
    attributes: v.attributes as Record<string, unknown>,
    price: v.price.toString(),
    compareAtPrice: v.compareAtPrice ? v.compareAtPrice.toString() : null,
    inventoryQty: v.inventoryQty,
  };
}

export function toProductDto(
  p: Product & { variants: ProductVariant[]; category: Category | null },
): ProductDto {
  return {
    id: p.id,
    name: p.name,
    slug: p.slug,
    description: p.description,
    status: p.status,
    images: p.images,
    categoryId: p.categoryId,
    category: p.category ? toCategoryDto(p.category) : null,
    variants: p.variants.map(toVariantDto),
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
  };
}
