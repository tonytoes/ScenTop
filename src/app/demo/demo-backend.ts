// An offline copy of the ScenTop API for the demo APK (environment.demo). It answers every call the shop
// makes from the built-in catalogue, and keeps accounts, carts, wishlists, orders and reviews on the phone.
// Responses have the same shape as server/lib/dto.ts and errors the same shape as the real API, so the
// rest of the app does not know the difference.
import { HttpErrorResponse, HttpRequest, HttpResponse } from '@angular/common/http';
import catalogue from './demo-catalogue.json';
import type { Cart, CartItem, CategoryCount, Order, ProductDetail, ProductSummary, Review, User } from '../core/models';
import { CATEGORIES } from '../core/models';

type Product = (typeof catalogue)[number];

interface DemoUser {
  id: number;
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phone: string;
  address: string;
  photoUrl: string | null;
}

interface DemoReview {
  id: number;
  productId: number;
  userId: number;
  rating: number;
  comment: string;
  createdAt: string;
}

interface DemoState {
  nextId: number;
  users: DemoUser[];
  sessions: Record<string, number>;
  carts: Record<number, { variantId: number; quantity: number }[]>;
  wishlists: Record<number, number[]>;
  orders: (Omit<Order, 'orderNumber' | 'itemCount'> & { userId: number })[];
  reviews: DemoReview[];
}

const STORAGE_KEY = 'scentop.demo.v1';
const SHIPPING_FEE_CENTS = 5000;
const MAX_QUANTITY = 99;
const DEMO_USER = { email: 'demo@scentop.app', password: 'demo12345' };

const daysAgo = (days: number) => new Date(Date.now() - days * 86_400_000).toISOString();

/** A demo customer and a few reviews, so the app does not look empty the first time it opens. */
function initialState(): DemoState {
  const reviewers = [
    { id: 1, email: DEMO_USER.email, password: DEMO_USER.password, firstName: 'Demo', lastName: 'Customer', phone: '09171234567', address: '123 Rizal St., Quezon City', photoUrl: null },
    { id: 2, email: 'maria@demo.scentop.app', password: 'not-for-login', firstName: 'Maria', lastName: 'Santos', phone: '09180000000', address: '', photoUrl: null },
    { id: 3, email: 'paolo@demo.scentop.app', password: 'not-for-login', firstName: 'Paolo', lastName: 'Reyes', phone: '09190000000', address: '', photoUrl: null },
  ];
  const comments = ['Lasts all day, I get compliments every time.', 'Lovely scent, a little strong at first.', 'My new everyday perfume.', ''];
  const reviews: DemoReview[] = [];
  let id = 1;
  catalogue.forEach((product, index) => {
    for (const userId of [2, 3]) {
      if ((index + userId) % 3 === 0) continue;
      reviews.push({ id: id++, productId: product.id, userId, rating: 3 + ((index + userId) % 3), comment: comments[(index + userId) % comments.length]!, createdAt: daysAgo(3 + index + userId) });
    }
  });
  return { nextId: 100, users: reviewers, sessions: {}, carts: {}, wishlists: {}, orders: [], reviews };
}

function load(): DemoState {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) return JSON.parse(saved) as DemoState;
  } catch {
    // Storage blocked or damaged: start fresh
  }
  return initialState();
}

let state = load();
const save = () => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // The demo still works for this visit
  }
};
const newId = () => state.nextId++;

class ApiFailure {
  constructor(
    readonly status: number,
    readonly message: string,
    readonly code: string,
    readonly fields?: Record<string, string>,
  ) {}
}
const fail = (status: number, message: string, code = 'bad_request', fields?: Record<string, string>): never => {
  throw new ApiFailure(status, message, code, fields);
};

// ---- Validation, matching server/lib/validate.ts ----------------------------------------------------

type Body = Record<string, unknown>;

class Checker {
  readonly fields: Record<string, string> = {};
  constructor(private readonly body: Body) {}

  private set(key: string, message: string) {
    this.fields[key] ??= message;
  }
  text(key: string, label: string, { required = true, min = 1, max = 60, minMessage = '' } = {}): string {
    const raw = this.body[key];
    const value = typeof raw === 'string' ? raw.trim() : '';
    if (required && !value) this.set(key, `${label} is required.`);
    else if (value && value.length < min) this.set(key, minMessage || `${label} is required.`);
    else if (value.length > max) this.set(key, `${label} is too long.`);
    return value;
  }
  email(key = 'email'): string {
    const value = typeof this.body[key] === 'string' ? (this.body[key] as string).trim() : '';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) || value.length > 254) this.set(key, 'Enter a valid e-mail address.');
    return value;
  }
  phone(key = 'phone'): string {
    const value = typeof this.body[key] === 'string' ? (this.body[key] as string).trim() : '';
    if (!/^[0-9+\-\s()]{7,20}$/.test(value)) this.set(key, 'Enter a valid phone number.');
    return value;
  }
  password(key: string): string {
    const value = typeof this.body[key] === 'string' ? (this.body[key] as string) : '';
    if (!value) this.set(key, 'Password is required.');
    else if (value.length < 8) this.set(key, 'Password must be at least 8 characters.');
    else if (value.length > 72) this.set(key, 'Password is too long.');
    return value;
  }
  done() {
    if (Object.keys(this.fields).length) fail(400, 'Please check the highlighted fields.', 'validation', this.fields);
  }
}

// ---- Catalogue -------------------------------------------------------------------------------------

function rating(productId: number) {
  const ratings = state.reviews.filter((review) => review.productId === productId).map((review) => review.rating);
  const avg = ratings.length ? ratings.reduce((a, b) => a + b, 0) / ratings.length : 0;
  return { ratingAvg: Math.round(avg * 10) / 10, ratingCount: ratings.length };
}

function summary(product: Product): ProductSummary {
  return {
    id: product.id,
    slug: product.slug,
    name: product.name,
    category: product.category as ProductSummary['category'],
    audience: product.audience as ProductSummary['audience'],
    imageUrl: product.imageUrl,
    isBestSeller: product.isBestSeller,
    isNewArrival: product.isNewArrival,
    fromPriceCents: Math.min(...product.variants.map((variant) => variant.priceCents)),
    ...rating(product.id),
    variants: product.variants,
  };
}

const detail = (product: Product): ProductDetail => ({ ...summary(product), description: product.description, scentNotes: product.scentNotes });

function findProduct(idOrSlug: string): Product {
  const product = /^\d+$/.test(idOrSlug) ? catalogue.find((p) => p.id === Number(idOrSlug)) : catalogue.find((p) => p.slug === idOrSlug);
  return product ?? fail(404, 'We could not find that perfume.', 'not_found');
}

function listProducts(params: URLSearchParams) {
  const q = params.get('q')?.trim().toLowerCase() ?? '';
  const category = params.get('category');
  const audience = params.get('audience');
  const collection = params.get('collection');
  const ids = params.get('ids')?.split(',').map(Number);
  const sort = params.get('sort') ?? 'featured';
  const limit = Math.min(100, Math.max(1, Number(params.get('limit')) || 12));
  const offset = Math.max(0, Number(params.get('offset')) || 0);

  let items = catalogue.map(summary);
  const byId = new Map(catalogue.map((p) => [p.id, p]));
  if (q) {
    items = items.filter((item) => {
      const p = byId.get(item.id)!;
      return [p.name, p.description, p.category, ...p.scentNotes].some((text) => text.toLowerCase().includes(q));
    });
  }
  if (category) items = items.filter((item) => item.category === category);
  // "For men" also includes unisex perfumes
  if (audience) items = items.filter((item) => item.audience === audience || item.audience === 'unisex');
  if (collection === 'best') items = items.filter((item) => item.isBestSeller);
  if (collection === 'new') items = items.filter((item) => item.isNewArrival);
  if (ids) items = items.filter((item) => ids.includes(item.id));

  const sorts: Record<string, (a: ProductSummary, b: ProductSummary) => number> = {
    featured: (a, b) => Number(b.isBestSeller) - Number(a.isBestSeller) || a.id - b.id,
    newest: (a, b) => Number(b.isNewArrival) - Number(a.isNewArrival) || b.id - a.id,
    'price-asc': (a, b) => a.fromPriceCents - b.fromPriceCents || a.id - b.id,
    'price-desc': (a, b) => b.fromPriceCents - a.fromPriceCents || a.id - b.id,
    name: (a, b) => a.name.localeCompare(b.name),
    rating: (a, b) => b.ratingAvg - a.ratingAvg || b.ratingCount - a.ratingCount || a.id - b.id,
  };
  items.sort(sorts[sort] ?? sorts['featured']);
  return { items: items.slice(offset, offset + limit), total: items.length };
}

function reviewsFor(product: Product): Review[] {
  return state.reviews
    .filter((review) => review.productId === product.id)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map((review) => {
      const author = state.users.find((user) => user.id === review.userId);
      return { id: review.id, rating: review.rating, comment: review.comment, createdAt: review.createdAt, author: author ? `${author.firstName} ${author.lastName.charAt(0)}.` : 'Customer' };
    });
}

// ---- Cart ------------------------------------------------------------------------------------------

const variantInfo = (variantId: number) => {
  for (const product of catalogue) {
    const variant = product.variants.find((v) => v.id === variantId);
    if (variant) return { product, variant };
  }
  return null;
};

function priceCart(lines: { variantId: number; quantity: number }[]): Cart {
  const merged = new Map<number, number>();
  for (const line of lines) merged.set(line.variantId, Math.min(MAX_QUANTITY, (merged.get(line.variantId) ?? 0) + line.quantity));
  const items: CartItem[] = [];
  for (const [variantId, quantity] of merged) {
    const info = variantInfo(variantId);
    if (!info) continue;
    items.push({
      variantId,
      productId: info.product.id,
      slug: info.product.slug,
      name: info.product.name,
      imageUrl: info.product.imageUrl,
      sizeMl: info.variant.sizeMl,
      unitPriceCents: info.variant.priceCents,
      quantity,
      lineTotalCents: info.variant.priceCents * quantity,
    });
  }
  const subtotalCents = items.reduce((sum, item) => sum + item.lineTotalCents, 0);
  const shippingFeeCents = items.length ? SHIPPING_FEE_CENTS : 0;
  return { items, itemCount: items.reduce((sum, item) => sum + item.quantity, 0), subtotalCents, shippingFeeCents, totalCents: subtotalCents + shippingFeeCents };
}

function readLines(value: unknown): { variantId: number; quantity: number }[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((line) => ({ variantId: Number(line?.variantId), quantity: Number(line?.quantity) }))
    .filter((line) => Number.isInteger(line.variantId) && Number.isInteger(line.quantity) && line.quantity >= 1 && line.quantity <= MAX_QUANTITY);
}

function readQuantity(value: unknown): number {
  const quantity = Number(value);
  if (!Number.isInteger(quantity)) fail(400, 'Please check the highlighted fields.', 'validation', { quantity: 'Quantity must be a number.' });
  if (quantity < 1) fail(400, 'Please check the highlighted fields.', 'validation', { quantity: 'Quantity must be at least 1.' });
  if (quantity > MAX_QUANTITY) fail(400, 'Please check the highlighted fields.', 'validation', { quantity: `You can order up to ${MAX_QUANTITY} of one item.` });
  return quantity;
}

// ---- Accounts --------------------------------------------------------------------------------------

const toUser = (user: DemoUser): User => ({
  id: user.id,
  email: user.email,
  firstName: user.firstName,
  lastName: user.lastName,
  phone: user.phone,
  address: user.address,
  photoUrl: user.photoUrl,
  hasPassword: true,
});

function startSession(user: DemoUser) {
  const token = `demo-${user.id}-${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
  state.sessions[token] = user.id;
  return { token, user: toUser(user) };
}

function currentUser(request: HttpRequest<unknown>): DemoUser {
  const token = request.headers.get('Authorization')?.replace(/^Bearer /, '') ?? '';
  const user = state.users.find((u) => u.id === state.sessions[token]);
  return user ?? fail(401, 'Please log in to continue.', 'unauthorized');
}

const wishlist = (userId: number): ProductSummary[] =>
  (state.wishlists[userId] ?? []).map((id) => catalogue.find((p) => p.id === id)).filter((p): p is Product => !!p).map(summary);

const toOrder = (order: DemoState['orders'][number]): Order => {
  const { userId: _userId, ...rest } = order;
  return { ...rest, orderNumber: `ST-${String(order.id).padStart(6, '0')}`, itemCount: order.items.reduce((sum, item) => sum + item.quantity, 0) };
};

function findOrder(userId: number, id: string) {
  return state.orders.find((order) => order.userId === userId && order.id === Number(id)) ?? fail(404, 'We could not find that order.', 'not_found');
}

// ---- Router ----------------------------------------------------------------------------------------

/** Answers one API call. `path` is the part after the API prefix, e.g. "/products/deep-rouge". */
function route(request: HttpRequest<unknown>, path: string, params: URLSearchParams): { status?: number; body: unknown } {
  const method = request.method;
  const body = (request.body ?? {}) as Body;
  const is = (m: string, pattern: RegExp) => method === m && pattern.test(path);
  const part = (index: number) => decodeURIComponent(path.split('/')[index] ?? '');

  // Catalogue
  if (is('GET', /^\/health$/)) return { body: { ok: true } };
  if (is('GET', /^\/products$/)) return { body: listProducts(params) };
  if (is('GET', /^\/categories$/)) {
    return { body: CATEGORIES.map((name): CategoryCount => ({ name, count: catalogue.filter((p) => p.category === name).length })) };
  }
  if (is('GET', /^\/products\/[^/]+$/)) return { body: detail(findProduct(part(2))) };
  if (is('GET', /^\/products\/[^/]+\/reviews$/)) return { body: reviewsFor(findProduct(part(2))) };
  if (is('POST', /^\/products\/[^/]+\/reviews$/)) {
    const user = currentUser(request);
    const product = findProduct(part(2));
    const value = Number(body['rating']);
    if (!Number.isInteger(value) || value < 1 || value > 5) fail(400, 'Please check the highlighted fields.', 'validation', { rating: 'Choose a rating.' });
    const comment = typeof body['comment'] === 'string' ? body['comment'].trim() : '';
    if (comment.length > 1000) fail(400, 'Please check the highlighted fields.', 'validation', { comment: 'Your review is too long.' });
    // Posting again replaces the customer's earlier review of the same perfume
    state.reviews = state.reviews.filter((review) => !(review.productId === product.id && review.userId === user.id));
    state.reviews.push({ id: newId(), productId: product.id, userId: user.id, rating: value, comment, createdAt: new Date().toISOString() });
    return { status: 201, body: detail(product) };
  }

  // Accounts
  if (is('POST', /^\/auth\/signup$/)) {
    const check = new Checker(body);
    const firstName = check.text('firstName', 'First name');
    const lastName = check.text('lastName', 'Last name');
    const email = check.email();
    const phone = check.phone();
    const password = check.password('password');
    check.done();
    if (state.users.some((user) => user.email.toLowerCase() === email.toLowerCase())) fail(409, 'An account with this e-mail already exists.', 'conflict');
    const user: DemoUser = { id: newId(), email, password, firstName, lastName, phone, address: '', photoUrl: null };
    state.users.push(user);
    return { status: 201, body: startSession(user) };
  }
  if (is('POST', /^\/auth\/login$/)) {
    const check = new Checker(body);
    const email = check.email();
    const password = check.text('password', 'Password', { max: 1000 });
    check.done();
    const user = state.users.find((u) => u.email.toLowerCase() === email.toLowerCase());
    if (!user || user.password !== password) fail(401, 'Incorrect e-mail or password.', 'invalid_credentials');
    return { body: startSession(user!) };
  }
  if (is('GET', /^\/auth\/me$/)) return { body: { user: toUser(currentUser(request)) } };
  if (is('PATCH', /^\/auth\/me$/)) {
    const user = currentUser(request);
    const check = new Checker(body);
    const has = (key: string) => body[key] !== undefined;
    const firstName = has('firstName') ? check.text('firstName', 'First name') : user.firstName;
    const lastName = has('lastName') ? check.text('lastName', 'Last name') : user.lastName;
    const phone = has('phone') ? check.phone() : user.phone;
    const address = has('address') ? check.text('address', 'Address', { required: false, max: 300 }) : user.address;
    let photoUrl = user.photoUrl;
    if (has('photoUrl')) {
      const value = body['photoUrl'];
      if (value !== null && (typeof value !== 'string' || !/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(value))) check.fields['photoUrl'] ??= 'Choose a PNG, JPG or WebP picture.';
      else if (typeof value === 'string' && value.length > 150_000) check.fields['photoUrl'] ??= 'That picture is too large.';
      else photoUrl = value as string | null;
    }
    check.done();
    Object.assign(user, { firstName, lastName, phone, address, photoUrl });
    return { body: { user: toUser(user) } };
  }
  if (is('POST', /^\/auth\/change-password$/)) {
    const user = currentUser(request);
    const check = new Checker(body);
    const currentPassword = check.text('currentPassword', 'Current password', { max: 1000 });
    const newPassword = check.password('newPassword');
    check.done();
    if (currentPassword !== user.password) fail(400, 'Your current password is incorrect.', 'validation', { currentPassword: 'Your current password is incorrect.' });
    user.password = newPassword;
    return { status: 204, body: null };
  }
  if (is('DELETE', /^\/auth\/me$/)) {
    const user = currentUser(request);
    if (body['password'] !== user.password) fail(400, 'That password is incorrect.', 'validation', { password: 'That password is incorrect.' });
    state.users = state.users.filter((u) => u.id !== user.id);
    state.sessions = Object.fromEntries(Object.entries(state.sessions).filter(([, id]) => id !== user.id));
    delete state.carts[user.id];
    delete state.wishlists[user.id];
    state.orders = state.orders.filter((order) => order.userId !== user.id);
    return { status: 204, body: null };
  }
  if (path.startsWith('/auth/otp') || path.startsWith('/auth/neon') || path === '/auth/delete-code') {
    fail(503, 'Passwordless login is not available in the demo app.', 'auth_not_configured');
  }

  // Cart
  if (is('POST', /^\/cart\/preview$/)) return { body: priceCart(readLines(body['items'])) };
  if (path === '/cart' || path.startsWith('/cart/')) {
    const user = currentUser(request);
    const lines = (state.carts[user.id] ??= []);
    if (is('GET', /^\/cart$/)) return { body: priceCart(lines) };
    if (is('DELETE', /^\/cart$/)) {
      state.carts[user.id] = [];
      return { body: priceCart([]) };
    }
    if (is('POST', /^\/cart\/items$/)) {
      const variantId = Number(body['variantId']);
      const quantity = readQuantity(body['quantity'] ?? 1);
      if (!variantInfo(variantId)) fail(404, 'We could not find that perfume size.', 'not_found');
      const line = lines.find((l) => l.variantId === variantId);
      if (line) line.quantity = Math.min(MAX_QUANTITY, line.quantity + quantity);
      else lines.push({ variantId, quantity });
      return { body: priceCart(lines) };
    }
    if (is('PATCH', /^\/cart\/items\/\d+$/)) {
      const quantity = readQuantity(body['quantity']);
      const line = lines.find((l) => l.variantId === Number(part(3))) ?? fail(404, 'That item is not in your cart.', 'not_found');
      line.quantity = quantity;
      return { body: priceCart(lines) };
    }
    if (is('DELETE', /^\/cart\/items\/\d+$/)) {
      state.carts[user.id] = lines.filter((l) => l.variantId !== Number(part(3)));
      return { body: priceCart(state.carts[user.id]!) };
    }
    if (is('POST', /^\/cart\/merge$/)) {
      for (const incoming of readLines(body['items'])) {
        if (!variantInfo(incoming.variantId)) continue;
        const line = lines.find((l) => l.variantId === incoming.variantId);
        if (line) line.quantity = Math.min(MAX_QUANTITY, line.quantity + incoming.quantity);
        else lines.push(incoming);
      }
      return { body: priceCart(lines) };
    }
  }

  // Wishlist
  if (path === '/wishlist' || path.startsWith('/wishlist/')) {
    const user = currentUser(request);
    const ids = (state.wishlists[user.id] ??= []);
    if (is('GET', /^\/wishlist$/)) return { body: wishlist(user.id) };
    if (is('PUT', /^\/wishlist\/\d+$/)) {
      const product = findProduct(part(2));
      // Newest first
      state.wishlists[user.id] = [product.id, ...ids.filter((id) => id !== product.id)];
      return { body: wishlist(user.id) };
    }
    if (is('DELETE', /^\/wishlist\/\d+$/)) {
      state.wishlists[user.id] = ids.filter((id) => id !== Number(part(2)));
      return { body: wishlist(user.id) };
    }
    if (is('POST', /^\/wishlist\/merge$/)) {
      const incoming = Array.isArray(body['productIds']) ? body['productIds'].map(Number) : [];
      const known = incoming.filter((id) => catalogue.some((p) => p.id === id) && !ids.includes(id));
      state.wishlists[user.id] = [...known.reverse(), ...ids];
      return { body: wishlist(user.id) };
    }
  }

  // Orders
  if (path === '/orders' || path.startsWith('/orders/')) {
    const user = currentUser(request);
    if (is('GET', /^\/orders$/)) {
      return { body: state.orders.filter((o) => o.userId === user.id).sort((a, b) => b.id - a.id).slice(0, 50).map(toOrder) };
    }
    if (is('GET', /^\/orders\/\d+$/)) return { body: toOrder(findOrder(user.id, part(2))) };
    if (is('POST', /^\/orders$/)) {
      const check = new Checker(body);
      const shipName = check.text('shipName', 'Full name');
      const shipPhone = check.phone('shipPhone');
      const shipAddress = check.text('shipAddress', 'Delivery address', { max: 300, min: 10, minMessage: 'Please enter your full delivery address.' });
      if (body['paymentMethod'] !== 'cod') check.fields['paymentMethod'] ??= 'Choose a payment method.';
      const notes = check.text('notes', 'Notes', { required: false, max: 300 });
      check.done();
      const cart = priceCart(state.carts[user.id] ?? []);
      if (!cart.items.length) fail(400, 'Your cart is empty.');
      const order: DemoState['orders'][number] = {
        id: newId(),
        userId: user.id,
        status: 'pending',
        paymentMethod: 'cod',
        subtotalCents: cart.subtotalCents,
        shippingFeeCents: cart.shippingFeeCents,
        totalCents: cart.totalCents,
        shipName,
        shipPhone,
        shipAddress,
        notes,
        createdAt: new Date().toISOString(),
        items: cart.items.map((item) => ({ productId: item.productId, slug: item.slug, name: item.name, imageUrl: item.imageUrl, sizeMl: item.sizeMl, unitPriceCents: item.unitPriceCents, quantity: item.quantity })),
      };
      state.orders.push(order);
      state.carts[user.id] = [];
      return { status: 201, body: toOrder(order) };
    }
    if (is('POST', /^\/orders\/\d+\/cancel$/)) {
      const order = findOrder(user.id, part(2));
      // Customers can cancel until the shop has confirmed the order
      if (order.status !== 'pending') fail(400, 'This order can no longer be cancelled.');
      order.status = 'cancelled';
      return { body: toOrder(order) };
    }
  }

  // Contact form: nothing to send it to offline, so it is only checked
  if (is('POST', /^\/contact$/)) {
    const check = new Checker(body);
    check.text('name', 'Name');
    check.email();
    check.text('message', 'Message', { max: 2000, min: 10, minMessage: 'Please write at least 10 characters.' });
    check.done();
    return { status: 201, body: { ok: true } };
  }

  return fail(404, 'Not found.', 'not_found');
}

/** Turns a request into the response (or error) the real API would have sent. */
export function handleDemoRequest(request: HttpRequest<unknown>, apiUrl: string): HttpResponse<unknown> {
  const url = new URL(request.urlWithParams, 'http://demo.local');
  const prefix = new URL(apiUrl, 'http://demo.local').pathname.replace(/\/$/, '');
  const path = url.pathname.slice(prefix.length) || '/';
  try {
    const { status = 200, body } = route(request, path, url.searchParams);
    save();
    return new HttpResponse({ status, body, url: request.url });
  } catch (error) {
    if (!(error instanceof ApiFailure)) throw error;
    throw new HttpErrorResponse({
      status: error.status,
      url: request.url,
      error: { error: { message: error.message, code: error.code, ...(error.fields ? { fields: error.fields } : {}) } },
    });
  }
}

export const DEMO_LOGIN = DEMO_USER;
