// These types mirror what the API sends (see server/lib/dto.ts).
// All money is in centavos: 185000 means ₱1,850.00. Show it with the `peso` pipe.

export const CATEGORIES = ['Floral', 'Refreshing', 'Gourmand', 'Signature', 'Verdant'] as const;
export type Category = (typeof CATEGORIES)[number];

export type Audience = 'women' | 'men' | 'unisex';

export interface User {
  id: number;
  email: string;
  firstName: string;
  lastName: string;
  phone: string;
  address: string;
  photoUrl: string | null;
}

export interface Variant {
  id: number;
  sizeMl: number;
  priceCents: number;
}

export interface ProductSummary {
  id: number;
  slug: string;
  name: string;
  category: Category;
  audience: Audience;
  imageUrl: string;
  isBestSeller: boolean;
  isNewArrival: boolean;
  fromPriceCents: number;
  ratingAvg: number;
  ratingCount: number;
  variants: Variant[];
}

export interface ProductDetail extends ProductSummary {
  description: string;
  scentNotes: string[];
}

export interface ProductList {
  items: ProductSummary[];
  total: number;
}

export type ProductSort = 'featured' | 'newest' | 'price-asc' | 'price-desc' | 'name' | 'rating';

export interface ProductQuery {
  q?: string;
  category?: Category;
  audience?: 'women' | 'men';
  collection?: 'best' | 'new';
  sort?: ProductSort;
  ids?: number[];
  limit?: number;
  offset?: number;
}

export interface CategoryCount {
  name: Category;
  count: number;
}

export interface Review {
  id: number;
  rating: number;
  comment: string;
  createdAt: string;
  author: string;
}

export interface CartItem {
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

export interface Cart {
  items: CartItem[];
  itemCount: number;
  subtotalCents: number;
  shippingFeeCents: number;
  totalCents: number;
}

export const EMPTY_CART: Cart = { items: [], itemCount: 0, subtotalCents: 0, shippingFeeCents: 0, totalCents: 0 };

export type OrderStatus = 'pending' | 'confirmed' | 'shipped' | 'delivered' | 'cancelled';

export interface OrderItem {
  productId: number | null;
  slug: string;
  name: string;
  imageUrl: string;
  sizeMl: number;
  unitPriceCents: number;
  quantity: number;
}

export interface Order {
  id: number;
  orderNumber: string;
  status: OrderStatus;
  paymentMethod: 'cod';
  subtotalCents: number;
  shippingFeeCents: number;
  totalCents: number;
  shipName: string;
  shipPhone: string;
  shipAddress: string;
  notes: string;
  createdAt: string;
  itemCount: number;
  items: OrderItem[];
}

export interface CheckoutForm {
  shipName: string;
  shipPhone: string;
  shipAddress: string;
  paymentMethod: 'cod';
  notes: string;
}
