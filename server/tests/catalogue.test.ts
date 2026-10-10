import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestApp, signUp, type TestApp } from './helpers';

let ctx: TestApp;
beforeAll(async () => {
  ctx = await createTestApp();
});
afterAll(() => ctx.db.close());

describe('catalogue', () => {
  it('reports health', async () => {
    const response = await request(ctx.app).get('/api/health');
    expect(response.body).toEqual({ status: 'ok' });
  });

  it('lists products with sizes and a starting price', async () => {
    const { body } = await request(ctx.app).get('/api/products?limit=60');
    expect(body.total).toBe(18);
    expect(body.items).toHaveLength(18);

    const deepRouge = body.items.find((p: { slug: string }) => p.slug === 'deep-rouge');
    expect(deepRouge.fromPriceCents).toBe(215000);
    expect(deepRouge.variants.map((v: { sizeMl: number }) => v.sizeMl)).toEqual([50, 100]);
  });

  it('filters by category, collection and audience', async () => {
    const floral = await request(ctx.app).get('/api/products?category=Floral&limit=60');
    expect(floral.body.items.every((p: { category: string }) => p.category === 'Floral')).toBe(true);

    const best = await request(ctx.app).get('/api/products?collection=best');
    expect(best.body.total).toBe(6);

    const men = await request(ctx.app).get('/api/products?audience=men&limit=60');
    const audiences = new Set(men.body.items.map((p: { audience: string }) => p.audience));
    expect(audiences).toEqual(new Set(['men', 'unisex']));
  });

  it('searches names, descriptions and scent notes', async () => {
    const byName = await request(ctx.app).get('/api/products?q=baybayon');
    expect(byName.body.items.map((p: { slug: string }) => p.slug)).toEqual(['baybayon']);

    const byNote = await request(ctx.app).get('/api/products?q=vetiver');
    expect(byNote.body.items.map((p: { slug: string }) => p.slug)).toEqual(['fume-shroom']);

    const nothing = await request(ctx.app).get('/api/products?q=zzzz');
    expect(nothing.body).toEqual({ items: [], total: 0 });
  });

  it('treats % and _ in a search as plain characters', async () => {
    const { body } = await request(ctx.app).get('/api/products?q=%25');
    expect(body.total).toBe(0);
  });

  it('sorts by price and paginates', async () => {
    const asc = await request(ctx.app).get('/api/products?sort=price-asc&limit=3');
    const prices = asc.body.items.map((p: { fromPriceCents: number }) => p.fromPriceCents);
    expect(prices).toEqual([...prices].sort((a, b) => a - b));
    expect(asc.body.items[0].slug).toBe('melissa');

    const page2 = await request(ctx.app).get('/api/products?sort=price-asc&limit=3&offset=3');
    expect(page2.body.items[0].slug).not.toBe('melissa');
    expect(page2.body.total).toBe(18);
  });

  it('looks products up by id list, id and slug', async () => {
    const detail = await request(ctx.app).get('/api/products/lilys-lush');
    expect(detail.body.scentNotes).toContain('Peony');

    const byId = await request(ctx.app).get(`/api/products/${detail.body.id}`);
    expect(byId.body.slug).toBe('lilys-lush');

    const ids = await request(ctx.app).get(`/api/products?ids=${detail.body.id},999`);
    expect(ids.body.items.map((p: { slug: string }) => p.slug)).toEqual(['lilys-lush']);
  });

  it('answers 404 for an unknown perfume and rejects bad query values', async () => {
    expect((await request(ctx.app).get('/api/products/nope')).status).toBe(404);
    expect((await request(ctx.app).get('/api/products?category=Spicy')).status).toBe(400);
    expect((await request(ctx.app).get('/api/nothing-here')).status).toBe(404);
  });

  it('counts perfumes per category', async () => {
    const { body } = await request(ctx.app).get('/api/categories');
    expect(body.map((c: { name: string }) => c.name)).toEqual(['Floral', 'Refreshing', 'Gourmand', 'Signature', 'Verdant']);
    expect(body.reduce((sum: number, c: { count: number }) => sum + c.count, 0)).toBe(18);
  });

  it('averages customer reviews, one per customer', async () => {
    const [a, b] = [await signUp(ctx.app), await signUp(ctx.app)];
    await request(ctx.app).post('/api/products/clio/reviews').set(a.auth).send({ rating: 5, comment: 'Lovely' });
    await request(ctx.app).post('/api/products/clio/reviews').set(b.auth).send({ rating: 4 });
    // posting again replaces the first review instead of adding a third
    const updated = await request(ctx.app).post('/api/products/clio/reviews').set(a.auth).send({ rating: 3, comment: 'Faded' });

    expect(updated.body.ratingCount).toBe(2);
    expect(updated.body.ratingAvg).toBe(3.5);

    const reviews = await request(ctx.app).get('/api/products/clio/reviews');
    expect(reviews.body).toHaveLength(2);
    expect(reviews.body[0].author).toBe('Maria S.');

    expect((await request(ctx.app).post('/api/products/clio/reviews').send({ rating: 5 })).status).toBe(401);
    expect((await request(ctx.app).post('/api/products/clio/reviews').set(a.auth).send({ rating: 9 })).status).toBe(400);
  });
});
