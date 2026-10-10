import type { Row } from '../db';

// The shapes below are what the API sends. The Angular app mirrors them in src/app/core/models.ts.

export interface UserDto {
  id: number;
  email: string;
  firstName: string;
  lastName: string;
  phone: string;
  address: string;
  photoUrl: string | null;
}

export const toUser = (row: Row): UserDto => ({
  id: row.id,
  email: row.email,
  firstName: row.first_name,
  lastName: row.last_name,
  phone: row.phone,
  address: row.address,
  photoUrl: row.photo_url,
});

export interface VariantDto {
  id: number;
  sizeMl: number;
  priceCents: number;
}

export interface ProductSummaryDto {
  id: number;
  slug: string;
  name: string;
  category: string;
  audience: string;
  imageUrl: string;
  isBestSeller: boolean;
  isNewArrival: boolean;
  fromPriceCents: number;
  ratingAvg: number;
  ratingCount: number;
  variants: VariantDto[];
}

export interface ProductDetailDto extends ProductSummaryDto {
  description: string;
  scentNotes: string[];
}

export const toProductSummary = (row: Row, variants: VariantDto[]): ProductSummaryDto => ({
  id: row.id,
  slug: row.slug,
  name: row.name,
  category: row.category,
  audience: row.audience,
  imageUrl: row.image_url,
  isBestSeller: row.is_best_seller,
  isNewArrival: row.is_new_arrival,
  fromPriceCents: row.from_price_cents,
  ratingAvg: Math.round(row.rating_avg * 10) / 10,
  ratingCount: row.rating_count,
  variants,
});

export interface CartItemDto {
  variantId: number;
  productId: number;
  slug: string;
  name: string;
  imageUrl: string;
  sizeMl: number;
  unitPriceCents: number;
  quantity: number;
  lineTotalCents: number;
}

export interface CartDto {
  items: CartItemDto[];
  itemCount: number;
  subtotalCents: number;
  shippingFeeCents: number;
  totalCents: number;
}

export interface OrderItemDto {
  productId: number | null;
  slug: string;
  name: string;
  imageUrl: string;
  sizeMl: number;
  unitPriceCents: number;
  quantity: number;
}

export interface OrderDto {
  id: number;
  orderNumber: string;
  status: string;
  paymentMethod: string;
  subtotalCents: number;
  shippingFeeCents: number;
  totalCents: number;
  shipName: string;
  shipPhone: string;
  shipAddress: string;
  notes: string;
  createdAt: string;
  itemCount: number;
  items: OrderItemDto[];
}

export const orderNumber = (id: number) => `ST-${String(id).padStart(6, '0')}`;
