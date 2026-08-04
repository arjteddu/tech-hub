export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api";

export type Category = { id: string; name: string; slug: string };

export type ProductVariant = {
  id: string;
  name: string;
  price: string;
  compareAtPrice: string | null;
  inventoryQty: number;
};

export type Product = {
  id: string;
  name: string;
  slug: string;
  description: string;
  images: string[];
  category: Category | null;
  variants: ProductVariant[];
};

export type CartItem = {
  id: string;
  variantId: string;
  quantity: number;
  variant: ProductVariant & { productId: string };
};

export type Cart = {
  id: string;
  items: CartItem[];
};

export type Address = {
  id: string;
  line1: string;
  line2: string | null;
  city: string;
  state: string;
  postalCode: string;
};

export type ProductListResponse = {
  items: Product[];
  total: number;
  page: number;
  pageCount: number;
};

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
