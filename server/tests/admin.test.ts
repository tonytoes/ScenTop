import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { makeAdmin, seedDemo } from '../db/admin';
import { createTestApp, signUp, type TestApp, type TestUser } from './helpers';

let ctx: TestApp;
let admin: TestUser;
let customer: TestUser;

beforeAll(async () => {
  ctx = await createTestApp();
  admin = await signUp(ctx.app);
  await makeAdmin(ctx.db, admin.email);
  customer = await signUp(ctx.app);
});
afterAll(() => ctx.db.close());

const product = {
  name: 'Test Bloom',
  category: 'Floral',
  audience: 'women',
  description: 'A test perfume.',
  scentNotes: ['Rose'],
  imageUrl: 'assets/products/clio.webp',
  variants: [{ sizeMl: 30, priceCents: 99000 }],
};

describe('admin access', () => {
  it('keeps customers and guests out', async () => {
    expect((await request(ctx.app).get('/api/admin/users')).status).toBe(401);
    expect((await request(ctx.app).get('/api/admin/users').set(customer.auth)).status).toBe(403);
    expect((await request(ctx.app).get('/api/admin/users').set(admin.auth)).status).toBe(200);
  });

  it('stops a disabled customer from logging in', async () => {
    const victim = await signUp(ctx.app);
    await request(ctx.app).patch(`/api/admin/users/${victim.id}`).set(admin.auth).send({ isDisabled: true }).expect(200);
    expect((await request(ctx.app).get('/api/auth/me').set(victim.auth)).status).toBe(401);
    const login = await request(ctx.app).post('/api/auth/login').send({ email: victim.email, password: 'secret-pass-1' });
    expect(login.status).toBe(403);
  });

  it('does not let an admin remove their own access', async () => {
    const response = await request(ctx.app).patch(`/api/admin/users/${admin.id}`).set(admin.auth).send({ role: 'customer' });
    expect(response.status).toBe(400);
  });
});

describe('admin products', () => {
  it('creates, hides and deletes a perfume', async () => {
    const created = await request(ctx.app).post('/api/admin/products').set(admin.auth).send(product).expect(201);
    expect(created.body).toMatchObject({ slug: 'test-bloom', isActive: true, variants: [{ sizeMl: 30, priceCents: 99000 }] });
    expect((await request(ctx.app).get('/api/products/test-bloom')).status).toBe(200);

    await request(ctx.app).put(`/api/admin/products/${created.body.id}`).set(admin.auth).send({ ...product, isActive: false }).expect(200);
    expect((await request(ctx.app).get('/api/products/test-bloom')).status).toBe(404);

    await request(ctx.app).delete(`/api/admin/products/${created.body.id}`).set(admin.auth).expect(204);
  });

  it('rejects a duplicate slug', async () => {
    const response = await request(ctx.app).post('/api/admin/products').set(admin.auth).send({ ...product, slug: 'deep-rouge' });
    expect(response.status).toBe(409);
  });
});

describe('admin orders and analytics', () => {
  beforeAll(() => seedDemo(ctx.db, 60));

  it('lists orders with counts per status and updates a status', async () => {
    const { body } = await request(ctx.app).get('/api/admin/orders?limit=5').set(admin.auth).expect(200);
    expect(body.items).toHaveLength(5);
    expect(body.total).toBeGreaterThan(5);
    expect(Object.keys(body.counts)).toEqual(['pending', 'confirmed', 'shipped', 'delivered', 'cancelled']);

    const updated = await request(ctx.app).patch(`/api/admin/orders/${body.items[0].id}`).set(admin.auth).send({ status: 'shipped' }).expect(200);
    expect(updated.body.status).toBe('shipped');
  });

  it('shows a customer with their buy history', async () => {
    const { body: list } = await request(ctx.app).get('/api/admin/users?sort=spent&limit=1').set(admin.auth).expect(200);
    const { body } = await request(ctx.app).get(`/api/admin/users/${list.items[0].id}`).set(admin.auth).expect(200);
    expect(body.orders.length).toBe(list.items[0].orderCount + body.orders.filter((o: { status: string }) => o.status === 'cancelled').length);
  });

  it('builds the dashboard', async () => {
    const { body } = await request(ctx.app).get('/api/admin/analytics?days=30').set(admin.auth).expect(200);
    expect(body.daily).toHaveLength(30);
    expect(body.kpis.revenue.value).toBeGreaterThan(0);
    expect(body.daily.reduce((sum: number, d: { revenue: number }) => sum + d.revenue, 0)).toBe(body.kpis.revenue.value);
    expect(body.categories).toHaveLength(5);
    expect(body.topProducts.length).toBeGreaterThan(0);
    expect((await request(ctx.app).get('/api/admin/analytics?days=12').set(admin.auth)).status).toBe(400);
  });
});
