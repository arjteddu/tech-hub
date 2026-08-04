import type {
  CategoryDto,
  ProductVariantDto,
  ProductDto,
  CartItemDto,
  CartDto,
  AddressDto,
  ProductListResponseDto,
} from "shared";

export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api";

// Re-exported under the names this app already uses, but the shapes
// themselves come from `shared` — the api's mappers and this file now
// describe the same contract, so a field rename on one side fails to
// compile on the other instead of silently drifting.
export type Category = CategoryDto;
export type ProductVariant = ProductVariantDto;
export type Product = ProductDto;
export type CartItem = CartItemDto;
export type Cart = CartDto;
export type Address = AddressDto;
export type ProductListResponse = ProductListResponseDto;

// Server-side reads (catalog browsing) hit the API directly with no auth —
// used from Server Components so product pages can be statically/ISR cached.
export async function getProducts(params: { page?: number; category?: string; q?: string } = {}) {
  const qs = new URLSearchParams();
  if (params.page) qs.set("page", String(params.page));
  if (params.category) qs.set("category", params.category);
  if (params.q) qs.set("q", params.q);

  const res = await fetch(`${API_URL}/catalog/products?${qs.toString()}`, {
    next: { revalidate: 60 },
  });
  if (!res.ok) throw new Error("Failed to load products");
  return res.json() as Promise<ProductListResponse>;
}

export async function getProduct(slug: string) {
  const res = await fetch(`${API_URL}/catalog/products/${slug}`, {
    next: { revalidate: 60 },
  });
  if (!res.ok) return null;
  return res.json() as Promise<Product>;
}
