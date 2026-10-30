import { HttpErrorResponse, HttpHeaders, HttpParams, HttpRequest } from '@angular/common/http';
import { Cart, Order, ProductDetail, ProductList, ProductSummary } from '../core/models';
import { DEMO_LOGIN, handleDemoRequest } from './demo-backend';

const API = '/api';

function call<T>(method: string, path: string, body: unknown = null, token?: string, params: Record<string, string> = {}): T {
  const headers = token ? new HttpHeaders({ Authorization: `Bearer ${token}` }) : new HttpHeaders();
  const request = new HttpRequest(method, `${API}${path}`, body, { headers, params: new HttpParams({ fromObject: params }) });
  return handleDemoRequest(request, API).body as T;
}

function error(method: string, path: string, body: unknown = null, token?: string) {
  try {
    call(method, path, body, token);
  } catch (e) {
    return (e as HttpErrorResponse);
  }
  throw new Error('Expected the call to fail');
}

describe('offline demo backend', () => {
  let token: string;

  beforeEach(() => {
    localStorage.clear();
    token = call<{ token: string }>('POST', '/auth/login', DEMO_LOGIN).token;
  });

  it('lists, filters and finds perfumes from the built-in catalogue', () => {
    const all = call<ProductList>('GET', '/products', null, undefined, { limit: '100' });
    expect(all.total).toBe(30);
    const floral = call<ProductList>('GET', '/products', null, undefined, { category: 'Floral', limit: '100' });
    expect(floral.items.every((p) => p.category === 'Floral')).toBe(true);
    const cheap = call<ProductList>('GET', '/products', null, undefined, { sort: 'price-asc' });
    expect(cheap.items[0]!.fromPriceCents).toBeLessThanOrEqual(cheap.items[1]!.fromPriceCents);
    expect(call<ProductDetail>('GET', '/products/deep-rouge').scentNotes).toContain('Oud');
    expect(error('GET', '/products/nope').status).toBe(404);
  });

  it('rejects a wrong password and invalid sign-ups like the real API', () => {
    expect(error('POST', '/auth/login', { email: DEMO_LOGIN.email, password: 'wrong-pass' }).status).toBe(401);
    const invalid = error('POST', '/auth/signup', { firstName: '', lastName: 'X', email: 'bad', phone: '1', password: 'short' });
    expect(invalid.status).toBe(400);
    expect(Object.keys(invalid.error.error.fields)).toEqual(expect.arrayContaining(['firstName', 'email', 'phone', 'password']));
    expect(error('POST', '/auth/signup', { firstName: 'A', lastName: 'B', email: DEMO_LOGIN.email, phone: '09171234567', password: 'password1' }).status).toBe(409);
  });

  it('turns the cart into an order, keeps it after a restart, and lets the customer cancel it', () => {
    call<Cart>('POST', '/cart/items', { variantId: 3, quantity: 2 }, token);
    const cart = call<Cart>('GET', '/cart', null, token);
    expect(cart.itemCount).toBe(2);
    expect(cart.totalCents).toBe(cart.subtotalCents + 5000);

    expect(error('POST', '/orders', { shipName: 'A', shipPhone: '09171234567', shipAddress: 'short', paymentMethod: 'cod' }, token).error.error.fields.shipAddress).toMatch(/full delivery address/);
    const order = call<Order>('POST', '/orders', { shipName: 'Demo Customer', shipPhone: '09171234567', shipAddress: '123 Rizal St., Quezon City', paymentMethod: 'cod' }, token);
    expect(order.orderNumber).toMatch(/^ST-\d{6}$/);
    expect(order.totalCents).toBe(cart.totalCents);
    expect(call<Cart>('GET', '/cart', null, token).itemCount).toBe(0);

    // A new app start reads everything back from storage
    expect(call<Order[]>('GET', '/orders', null, token).map((o) => o.id)).toEqual([order.id]);
    expect(call<Order>('POST', `/orders/${order.id}/cancel`, {}, token).status).toBe('cancelled');
    expect(error('POST', `/orders/${order.id}/cancel`, {}, token).status).toBe(400);
  });

  it('keeps a wishlist and reviews for the logged-in customer', () => {
    expect(call<ProductSummary[]>('PUT', '/wishlist/2', {}, token).map((p) => p.id)).toEqual([2]);
    expect(call<ProductSummary[]>('DELETE', '/wishlist/2', null, token)).toEqual([]);
    const before = call<ProductDetail>('GET', '/products/1').ratingCount;
    call('POST', '/products/1/reviews', { rating: 5, comment: 'Great' }, token);
    call('POST', '/products/1/reviews', { rating: 4, comment: 'Still great' }, token);
    expect(call<ProductDetail>('GET', '/products/1').ratingCount).toBe(before + 1);
  });

  it('needs a login for member-only calls and has no email-code sign-in', () => {
    expect(error('GET', '/orders').status).toBe(401);
    expect(error('POST', '/auth/otp/send', { email: 'a@b.co' }).status).toBe(503);
  });
});
