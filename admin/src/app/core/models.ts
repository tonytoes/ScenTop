// What the admin API sends (see server/routes/admin.ts and server/services/analytics.ts).
// Money is always in centavos: 185000 means ₱1,850.00.

export const CATEGORIES = ['Floral', 'Refreshing', 'Gourmand', 'Signature', 'Verdant'] as const;
export type Category = (typeof CATEGORIES)[number];
export type Audience = 'women' | 'men' | 'unisex';
export const ORDER_STATUSES = ['pending', 'confirmed', 'shipped', 'delivered', 'cancelled'] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];
export type Role = 'customer' | 'admin';

export interface User {
  id: number;
  email: string;
  firstName: string;
  lastName: string;
  phone: string;
  address: string;
  photoUrl: string | null;
  role: Role;
}

export interface AdminUser extends User {
  isDisabled: boolean;
  createdAt: string;
  orderCount: number;
  totalSpentCents: number;
  lastOrderAt: string | null;
}

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
  items: OrderItem[];
  customer?: { id: number; email: string; name: string } | null;
  updatedAt?: string;
}

export interface Page<T> {
  items: T[];
  total: number;
}

export interface OrderPage extends Page<Order> {
  counts: Record<OrderStatus, number>;
}

export interface CustomerDetail {
  user: AdminUser;
  orders: Order[];
  wishlist: { id: number; name: string; imageUrl: string }[];
  cart: { name: string; imageUrl: string; sizeMl: number; priceCents: number; quantity: number }[];
  reviews: { rating: number; comment: string; createdAt: string; product: string }[];
}

export interface Variant {
  id?: number;
  sizeMl: number;
  priceCents: number;
}

export interface AdminProduct {
  id: number;
  slug: string;
  name: string;
  category: Category;
  audience: Audience;
  description: string;
  scentNotes: string[];
  imageUrl: string;
  isBestSeller: boolean;
  isNewArrival: boolean;
  isActive: boolean;
  createdAt: string;
  ratingAvg: number;
  ratingCount: number;
  wishCount: number;
  unitsSold: number;
  revenueCents: number;
  variants: Variant[];
}

export type ProductInput = Pick<
  AdminProduct,
  'name' | 'slug' | 'category' | 'audience' | 'description' | 'scentNotes' | 'imageUrl' | 'isBestSeller' | 'isNewArrival' | 'isActive' | 'variants'
>;

export interface ContactMessage {
  id: number;
  name: string;
  email: string;
  message: string;
  createdAt: string;
}

export interface Metric {
  value: number;
  previous: number;
}

export interface Analytics {
  range: { days: number; from: string; to: string };
  kpis: Record<'revenue' | 'orders' | 'averageOrder' | 'newCustomers' | 'cancelRate' | 'buyers', Metric>;
  daily: { date: string; revenue: number; orders: number; previousRevenue: number }[];
  statuses: { status: OrderStatus; count: number }[];
  categories: { name: Category; units: number; revenue: number }[];
  sizes: { sizeMl: number; units: number; revenue: number }[];
  audience: { name: Audience; units: number }[];
  heatmap: { day: number; hour: number; orders: number }[];
  topProducts: { id: number; name: string; slug: string; imageUrl: string; category: Category; units: number; revenue: number }[];
  customerMix: { week: string; first: number; repeat: number }[];
  topCustomers: { id: number; name: string; email: string; photoUrl: string | null; orders: number; spentCents: number }[];
  month: { revenue: number; lastMonthRevenue: number; dayOfMonth: number; daysInMonth: number };
  carts: { shoppers: number; items: number; valueCents: number };
  mostWished: { id: number; name: string; imageUrl: string; saves: number }[];
  recentOrders: { id: number; orderNumber: string; status: OrderStatus; totalCents: number; customer: string; items: number; createdAt: string }[];
  totals: { customers: number; products: number; toConfirm: number; toShip: number; rating: number; reviews: number; newMessages: number; repeatRate: number };
}
