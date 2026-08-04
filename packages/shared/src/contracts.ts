// The wire contract between api and web. Money fields are strings (that's
// what a Decimal serializes to over JSON) and dates are ISO strings — this
// describes what actually crosses the network, not the Prisma types on
// the api side. Both api mappers and web's fetch layer type against this
// so a shape change fails to compile on whichever side didn't update.

export type UserRole = "CUSTOMER" | "ADMIN";
export type ProductStatus = "DRAFT" | "ACTIVE" | "ARCHIVED";
export type OrderStatus = "PENDING_PAYMENT" | "PAID" | "FULFILLED" | "CANCELLED" | "REFUNDED";

export interface AuthUserDto {
  id: string;
  email: string;
  name: string | null;
  role: UserRole;
}

export interface AuthResponseDto {
  user: AuthUserDto;
  accessToken: string;
  refreshToken: string;
}

export interface CategoryDto {
  id: string;
  name: string;
  slug: string;
  parentId: string | null;
}

export interface ProductVariantDto {
  id: string;
  productId: string;
  sku: string;
  name: string;
  attributes: Record<string, unknown>;
  price: string;
  compareAtPrice: string | null;
  inventoryQty: number;
}

export interface ProductDto {
  id: string;
  name: string;
  slug: string;
  description: string;
  status: ProductStatus;
  images: string[];
  categoryId: string | null;
  category: CategoryDto | null;
  variants: ProductVariantDto[];
  createdAt: string;
  updatedAt: string;
}

export interface ProductListResponseDto {
  items: ProductDto[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
}

export interface AddressDto {
  id: string;
  line1: string;
  line2: string | null;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  phone: string | null;
  isDefault: boolean;
}

export interface CartItemDto {
  id: string;
  variantId: string;
  quantity: number;
  variant: ProductVariantDto;
}

export interface CartDto {
  id: string;
  items: CartItemDto[];
}

export interface OrderItemDto {
  id: string;
  variantId: string;
  quantity: number;
  unitPrice: string;
  productNameSnapshot: string;
  variantNameSnapshot: string;
}

export interface OrderDto {
  id: string;
  status: OrderStatus;
  subtotal: string;
  shipping: string;
  tax: string;
  total: string;
  currency: string;
  items: OrderItemDto[];
  createdAt: string;
}

export interface CheckoutResponseDto {
  order: OrderDto;
  razorpayOrderId: string;
  razorpayKeyId: string;
  amount: number;
  currency: string;
}

export interface PresignedUploadDto {
  uploadUrl: string;
  publicUrl: string;
}
