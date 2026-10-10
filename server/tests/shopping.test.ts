import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestApp, signUp, variantId, type TestApp, type TestUser } from './helpers';

let ctx: TestApp;
let deepRouge50: number;
let deepRouge100: number;
let melissa50: number;
let user: TestUser;

beforeAll(async () => {
  ctx = await createTestApp();
  deepRouge50 = await variantId(ctx.app, 'deep-rouge', 50);
  deepRouge100 = await variantId(ctx.app, 'deep-rouge', 100);
  melissa50 = await variantId(ctx.app, 'melissa', 50);
});
afterAll(() => ctx.db.close());

const checkout = {
  shipName: 'Maria Santos',
  shipPhone: '0917 123 4567',
  shipAddress: 'E. Rodriguez Ave, Cubao, Quezon City',
  paymentMethod: 'cod',
};

describe('cart', () => {
  it('prices a guest cart without logging in and ignores unknown items', async () => {
    const response = await request(ctx.app)
      .post('/api/cart/preview')
      .send({ items: [{ variantId: deepRouge50, quantity: 2 }, { variantId: deepRouge50, quantity: 1 }, { variantId: 999999, quantity: 1 }] });

    expect(response.body.items).toHaveLength(1);
    expect(response.body.items[0]).toMatchObject({ quantity: 3, unitPriceCents: 215000, lineTotalCents: 645000 });
    expect(response.body).toMatchObject({ subtotalCents: 645000, shippingFeeCents: 5000, totalCents: 650000, itemCount: 3 });
  });

  it('charges no shipping for an empty cart', async () => {
    const { body } = await request(ctx.app).post('/api/cart/preview').send({ items: [] });
    expect(body).toMatchObject({ itemCount: 0, shippingFeeCents: 0, totalCents: 0 });
  });

  it('adds, changes and removes items for a logged-in user', async () => {
    user = await signUp(ctx.app);

    await request(ctx.app).post('/api/cart/items').set(user.auth).send({ variantId: deepRouge50, quantity: 2 });
    const added = await request(ctx.app).post('/api/cart/items').set(user.auth).send({ variantId: deepRouge50 });
    expect(added.body.items[0].quantity).toBe(3);

    await request(ctx.app).post('/api/cart/items').set(user.auth).send({ variantId: deepRouge100 });
    const changed = await request(ctx.app).patch(`/api/cart/items/${deepRouge100}`).set(user.auth).send({ quantity: 5 });
    expect(changed.body.items.map((i: { quantity: number }) => i.quantity)).toEqual([3, 5]);

    const removed = await request(ctx.app).delete(`/api/cart/items/${deepRouge50}`).set(user.auth);
    expect(removed.body.items).toHaveLength(1);
    expect(removed.body.items[0].sizeMl).toBe(100);

    const cleared = await request(ctx.app).delete('/api/cart').set(user.auth);
    expect(cleared.body.items).toEqual([]);
  });

  it('keeps each customer cart private', async () => {
    const other = await signUp(ctx.app);
    await request(ctx.app).post('/api/cart/items').set(user.auth).send({ variantId: melissa50 });
    expect((await request(ctx.app).get('/api/cart').set(other.auth)).body.items).toEqual([]);
    await request(ctx.app).delete('/api/cart').set(user.auth);
  });

  it('never lets one line go above 99', async () => {
    await request(ctx.app).post('/api/cart/items').set(user.auth).send({ variantId: melissa50, quantity: 90 });
    const { body } = await request(ctx.app).post('/api/cart/items').set(user.auth).send({ variantId: melissa50, quantity: 90 });
    expect(body.items[0].quantity).toBe(99);
    expect((await request(ctx.app).patch(`/api/cart/items/${melissa50}`).set(user.auth).send({ quantity: 100 })).status).toBe(400);
    expect((await request(ctx.app).patch(`/api/cart/items/${melissa50}`).set(user.auth).send({ quantity: 0 })).status).toBe(400);
    await request(ctx.app).delete('/api/cart').set(user.auth);
  });

  it('rejects an item that does not exist', async () => {
    expect((await request(ctx.app).post('/api/cart/items').set(user.auth).send({ variantId: 999999 })).status).toBe(404);
    expect((await request(ctx.app).patch('/api/cart/items/999999').set(user.auth).send({ quantity: 2 })).status).toBe(404);
  });

  it('merges a guest cart into the account after login', async () => {
    const member = await signUp(ctx.app);
    await request(ctx.app).post('/api/cart/items').set(member.auth).send({ variantId: melissa50, quantity: 1 });

    const { body } = await request(ctx.app)
      .post('/api/cart/merge')
      .set(member.auth)
      .send({ items: [{ variantId: melissa50, quantity: 2 }, { variantId: deepRouge50, quantity: 1 }, { variantId: 999999, quantity: 1 }] });

    const quantities = Object.fromEntries(body.items.map((i: { variantId: number; quantity: number }) => [i.variantId, i.quantity]));
    expect(quantities).toEqual({ [melissa50]: 3, [deepRouge50]: 1 });
  });
});

describe('wishlist', () => {
  it('saves, lists and removes perfumes, and tolerates repeats', async () => {
    const member = await signUp(ctx.app);
    const { body: clio } = await request(ctx.app).get('/api/products/clio');
    const { body: sephyr } = await request(ctx.app).get('/api/products/sephyr');

    await request(ctx.app).put(`/api/wishlist/${clio.id}`).set(member.auth);
    const again = await request(ctx.app).put(`/api/wishlist/${clio.id}`).set(member.auth);
    expect(again.status).toBe(200);
    expect(again.body).toHaveLength(1);

    const merged = await request(ctx.app).post('/api/wishlist/merge').set(member.auth).send({ productIds: [clio.id, sephyr.id, 999999] });
    expect(merged.body.map((p: { slug: string }) => p.slug).sort()).toEqual(['clio', 'sephyr']);

    const removed = await request(ctx.app).delete(`/api/wishlist/${clio.id}`).set(member.auth);
    expect(removed.body.map((p: { slug: string }) => p.slug)).toEqual(['sephyr']);

    expect((await request(ctx.app).put('/api/wishlist/999999').set(member.auth)).status).toBe(404);
    expect((await request(ctx.app).get('/api/wishlist')).status).toBe(401);
  });
});

describe('orders', () => {
  it('turns the cart into an order with database prices, then empties the cart', async () => {
    const buyer = await signUp(ctx.app);
    await request(ctx.app).post('/api/cart/items').set(buyer.auth).send({ variantId: deepRouge50, quantity: 2 });
    await request(ctx.app).post('/api/cart/items').set(buyer.auth).send({ variantId: melissa50 });

    // A client cannot choose its own prices: unknown fields are ignored
    const response = await request(ctx.app).post('/api/orders').set(buyer.auth).send({ ...checkout, totalCents: 1, notes: 'Gift wrap please' });
    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({
      status: 'pending',
      paymentMethod: 'cod',
      subtotalCents: 2 * 215000 + 79000,
      shippingFeeCents: 5000,
      totalCents: 2 * 215000 + 79000 + 5000,
      itemCount: 3,
      notes: 'Gift wrap please',
    });
    expect(response.body.orderNumber).toMatch(/^ST-\d{6}$/);
    expect(response.body.items.map((i: { name: string }) => i.name)).toEqual(['Deep Rouge', 'Melissa']);

    expect((await request(ctx.app).get('/api/cart').set(buyer.auth)).body.items).toEqual([]);
    expect((await request(ctx.app).get('/api/orders').set(buyer.auth)).body).toHaveLength(1);
  });

  it('keeps the price an item was bought at', async () => {
    const buyer = await signUp(ctx.app);
    await request(ctx.app).post('/api/cart/items').set(buyer.auth).send({ variantId: melissa50 });
    const order = await request(ctx.app).post('/api/orders').set(buyer.auth).send(checkout);

    await ctx.db.query('UPDATE product_variants SET price_cents = 999900 WHERE id = $1', [melissa50]);
    const later = await request(ctx.app).get(`/api/orders/${order.body.id}`).set(buyer.auth);
    expect(later.body.items[0].unitPriceCents).toBe(79000);
    await ctx.db.query('UPDATE product_variants SET price_cents = 79000 WHERE id = $1', [melissa50]);
  });

  it('refuses an empty cart and bad delivery details', async () => {
    const buyer = await signUp(ctx.app);
    const empty = await request(ctx.app).post('/api/orders').set(buyer.auth).send(checkout);
    expect(empty.status).toBe(400);
    expect(empty.body.error.message).toBe('Your cart is empty.');

    await request(ctx.app).post('/api/cart/items').set(buyer.auth).send({ variantId: melissa50 });
    const invalid = await request(ctx.app).post('/api/orders').set(buyer.auth).send({ ...checkout, shipAddress: 'x', paymentMethod: 'card' });
    expect(invalid.status).toBe(400);
    expect(Object.keys(invalid.body.error.fields).sort()).toEqual(['paymentMethod', 'shipAddress']);
  });

  it('shows an order only to the person who placed it', async () => {
    const buyer = await signUp(ctx.app);
    const stranger = await signUp(ctx.app);
    await request(ctx.app).post('/api/cart/items').set(buyer.auth).send({ variantId: melissa50 });
    const order = await request(ctx.app).post('/api/orders').set(buyer.auth).send(checkout);

    expect((await request(ctx.app).get(`/api/orders/${order.body.id}`).set(stranger.auth)).status).toBe(404);
    expect((await request(ctx.app).post(`/api/orders/${order.body.id}/cancel`).set(stranger.auth)).status).toBe(404);
    expect((await request(ctx.app).get('/api/orders').set(stranger.auth)).body).toEqual([]);
  });

  it('lets a customer cancel only while the order is pending', async () => {
    const buyer = await signUp(ctx.app);
    await request(ctx.app).post('/api/cart/items').set(buyer.auth).send({ variantId: melissa50 });
    const order = await request(ctx.app).post('/api/orders').set(buyer.auth).send(checkout);

    const cancelled = await request(ctx.app).post(`/api/orders/${order.body.id}/cancel`).set(buyer.auth);
    expect(cancelled.body.status).toBe('cancelled');
    expect((await request(ctx.app).post(`/api/orders/${order.body.id}/cancel`).set(buyer.auth)).status).toBe(400);

    await request(ctx.app).post('/api/cart/items').set(buyer.auth).send({ variantId: melissa50 });
    const second = await request(ctx.app).post('/api/orders').set(buyer.auth).send(checkout);
    await ctx.db.query(`UPDATE orders SET status = 'shipped' WHERE id = $1`, [second.body.id]);
    expect((await request(ctx.app).post(`/api/orders/${second.body.id}/cancel`).set(buyer.auth)).status).toBe(400);
  });
});

describe('contact', () => {
  it('stores a message and validates it', async () => {
    const ok = await request(ctx.app).post('/api/contact').send({ name: 'Ana', email: 'ana@example.test', message: 'Do you ship to Cebu?' });
    expect(ok.status).toBe(201);
    const [{ count }] = await ctx.db.query('SELECT count(*)::int AS count FROM contact_messages');
    expect(count).toBe(1);

    const bad = await request(ctx.app).post('/api/contact').send({ name: '', email: 'x', message: 'hi' });
    expect(bad.status).toBe(400);
    expect(Object.keys(bad.body.error.fields).sort()).toEqual(['email', 'message', 'name']);
  });
});
