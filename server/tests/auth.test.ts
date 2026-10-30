import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestApp, signUp, variantId, type TestApp } from './helpers';

let ctx: TestApp;
beforeAll(async () => {
  ctx = await createTestApp();
});
afterAll(() => ctx.db.close());

const validSignup = { firstName: 'Ana', lastName: 'Reyes', email: 'ana@example.test', phone: '09171234567', password: 'long-enough-1' };

describe('auth', () => {
  it('creates an account and returns a token without the password hash', async () => {
    const response = await request(ctx.app).post('/api/auth/signup').send(validSignup);
    expect(response.status).toBe(201);
    expect(response.body.token).toEqual(expect.any(String));
    expect(response.body.user).toMatchObject({ email: 'ana@example.test', firstName: 'Ana', photoUrl: null });
    expect(JSON.stringify(response.body)).not.toContain('password');
  });

  it('rejects a duplicate e-mail, whatever its letter case', async () => {
    const response = await request(ctx.app).post('/api/auth/signup').send({ ...validSignup, email: 'ANA@example.test' });
    expect(response.status).toBe(409);
    expect(response.body.error.message).toMatch(/already exists/);
  });

  it('explains which fields are wrong', async () => {
    const response = await request(ctx.app).post('/api/auth/signup').send({ ...validSignup, email: 'nope', password: 'short', phone: 'abc' });
    expect(response.status).toBe(400);
    expect(Object.keys(response.body.error.fields).sort()).toEqual(['email', 'password', 'phone']);
  });

  it('logs in with the right password only', async () => {
    const ok = await request(ctx.app).post('/api/auth/login').send({ email: 'Ana@Example.test', password: 'long-enough-1' });
    expect(ok.status).toBe(200);

    const wrongPassword = await request(ctx.app).post('/api/auth/login').send({ email: 'ana@example.test', password: 'wrong-wrong' });
    const unknownEmail = await request(ctx.app).post('/api/auth/login').send({ email: 'who@example.test', password: 'wrong-wrong' });
    expect(wrongPassword.status).toBe(401);
    expect(unknownEmail.status).toBe(401);
    expect(unknownEmail.body.error.message).toBe(wrongPassword.body.error.message);
  });

  it('protects private endpoints', async () => {
    expect((await request(ctx.app).get('/api/auth/me')).status).toBe(401);
    expect((await request(ctx.app).get('/api/cart').set('Authorization', 'Bearer garbage')).status).toBe(401);
    expect((await request(ctx.app).get('/api/orders')).status).toBe(401);
  });

  it('updates the profile and keeps fields that were not sent', async () => {
    const user = await signUp(ctx.app);
    const photo = 'data:image/jpeg;base64,/9j/4AAQSkZJRg==';

    const response = await request(ctx.app).patch('/api/auth/me').set(user.auth).send({ address: '12 Rizal St, Cubao, Quezon City', photoUrl: photo });
    expect(response.body.user).toMatchObject({ firstName: 'Maria', address: '12 Rizal St, Cubao, Quezon City', photoUrl: photo });

    const removed = await request(ctx.app).patch('/api/auth/me').set(user.auth).send({ photoUrl: null });
    expect(removed.body.user.photoUrl).toBeNull();
    expect(removed.body.user.address).toBe('12 Rizal St, Cubao, Quezon City');

    const notAPicture = await request(ctx.app).patch('/api/auth/me').set(user.auth).send({ photoUrl: 'javascript:alert(1)' });
    expect(notAPicture.status).toBe(400);
  });

  it('changes the password', async () => {
    const user = await signUp(ctx.app);

    const wrong = await request(ctx.app).post('/api/auth/change-password').set(user.auth).send({ currentPassword: 'nope-nope', newPassword: 'brand-new-pass' });
    expect(wrong.status).toBe(400);

    const ok = await request(ctx.app).post('/api/auth/change-password').set(user.auth).send({ currentPassword: 'secret-pass-1', newPassword: 'brand-new-pass' });
    expect(ok.status).toBe(204);

    const login = await request(ctx.app).post('/api/auth/login').send({ email: user.email, password: 'brand-new-pass' });
    expect(login.status).toBe(200);
  });

  it('deletes an account but keeps its orders without personal details', async () => {
    const user = await signUp(ctx.app);
    const variant = await variantId(ctx.app, 'sephyr', 50);
    await request(ctx.app).post('/api/cart/items').set(user.auth).send({ variantId: variant });
    const order = await request(ctx.app).post('/api/orders').set(user.auth).send({
      shipName: 'Maria Santos', shipPhone: '09171234567', shipAddress: '12 Rizal St, Cubao, Quezon City', paymentMethod: 'cod',
    });
    expect(order.status).toBe(201);

    const wrong = await request(ctx.app).delete('/api/auth/me').set(user.auth).send({ password: 'wrong-wrong' });
    expect(wrong.status).toBe(400);

    const deleted = await request(ctx.app).delete('/api/auth/me').set(user.auth).send({ password: 'secret-pass-1' });
    expect(deleted.status).toBe(204);

    expect((await request(ctx.app).get('/api/auth/me').set(user.auth)).status).toBe(401);
    expect((await request(ctx.app).post('/api/auth/login').send({ email: user.email, password: 'secret-pass-1' })).status).toBe(401);

    const [kept] = await ctx.db.query('SELECT user_id, ship_name, ship_address FROM orders WHERE id = $1', [order.body.id]);
    expect(kept).toEqual({ user_id: null, ship_name: 'Deleted account', ship_address: '' });
  });
});
