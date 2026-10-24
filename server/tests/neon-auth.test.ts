import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT } from 'jose';
import { createApp } from '../app';
import { loadConfig } from '../config';
import { createPgliteDb, type Db } from '../db';
import { migrate } from '../db/migrate';
import { createNeonVerifier, type NeonGateway, type NeonIdentity } from '../lib/neon-auth';
import { HttpError } from '../lib/errors';
import { signUp } from './helpers';

const base = 'https://auth.example.test/neondb/auth';
const issuer = new URL(base).origin;
const config = loadConfig({ NODE_ENV: 'test', JWT_SECRET: 'test-secret', NEON_AUTH_BASE_URL: base, AUTH_APP_ORIGIN: 'http://localhost:4200' });
let db: Db;
let app: ReturnType<typeof createApp>;
const identities = new Map<string, NeonIdentity>();
const gateway: NeonGateway = {
  verify: vi.fn(async token => {
    const identity = identities.get(token);
    if (!identity) throw new HttpError(400, 'Invalid identity', 'invalid_neon_proof');
    return identity;
  }),
  sendOtp: vi.fn(async () => undefined),
  verifyOtp: vi.fn(async (email, otp) => {
    if (otp !== '012345') throw new HttpError(400, 'Invalid code', 'otp_failed');
    return { issuer, subject: `otp:${email}`, email, name: 'Email Customer' };
  }),
};
function identity(key: string, email = `${key}@example.test`) {
  identities.set(key, { issuer, subject: key, email, name: 'Google Customer' });
  return key;
}
const exchange = (token: string) => request(app).post('/api/auth/neon/exchange').send({ neonToken: token });

beforeAll(async () => {
  db = await createPgliteDb(); await migrate(db);
  app = createApp({ db, config, neon: gateway });
});
afterAll(() => db.close());

describe('passwordless routes and identity ownership', () => {
  it('creates a passwordless customer and preserves the numeric ID on later sign-ins', async () => {
    const first = await exchange(identity('new-google'));
    expect(first.status).toBe(200);
    expect(first.body.user).toMatchObject({ hasPassword: false, firstName: '', lastName: '' });
    const second = await exchange('new-google');
    expect(second.body.user.id).toBe(first.body.user.id);
    expect((await request(app).get('/api/auth/me').set('Authorization', `Bearer ${first.body.token}`)).status).toBe(200);
    expect((await db.query('SELECT * FROM user_auth_identities WHERE subject = $1', ['new-google'])).length).toBe(1);
  });
  it('rejects an invalid external token', async () => {
    expect((await exchange('forged')).status).toBe(400);
  });
  it('never automatically links a matching email; correct password preserves the old customer', async () => {
    const old = await signUp(app);
    const result = await exchange(identity('matching', old.email.toUpperCase()));
    expect(result.status).toBe(409);
    expect(result.body.error.code).toBe('account_link_required');
    const linkTicket = result.body.error.fields.linkTicket;
    expect((await request(app).post('/api/auth/neon/link').send({ linkTicket, password: 'wrong' })).status).toBe(400);
    const linked = await request(app).post('/api/auth/neon/link').send({ linkTicket, password: 'secret-pass-1' });
    expect(linked.status).toBe(200);
    expect(linked.body.user.id).toBe(old.id);
    expect(linked.body.user.hasPassword).toBe(true);
    expect((await exchange('matching')).body.user.id).toBe(old.id);
  });
  it('rejects a forged link ticket', async () => {
    expect((await request(app).post('/api/auth/neon/link').send({ linkTicket: 'forged', password: 'secret-pass-1' })).status).toBe(400);
  });
  it('does not permit password login or password changes for a null-password customer', async () => {
    const signed = await exchange(identity('no-password'));
    expect((await request(app).post('/api/auth/login').send({ email: 'no-password@example.test', password: 'anything' })).status).toBe(401);
    expect((await request(app).post('/api/auth/change-password').set('Authorization', `Bearer ${signed.body.token}`).send({ currentPassword: 'anything', newPassword: 'long-enough-new' })).status).toBe(400);
  });
  it('sends an email code and verifies it on the server, preserving leading zeroes', async () => {
    expect((await request(app).post('/api/auth/otp/send').send({ email: 'otp-user@example.test' })).status).toBe(200);
    expect(gateway.sendOtp).toHaveBeenCalledWith('otp-user@example.test');
    const result = await request(app).post('/api/auth/otp/verify').send({ email: 'otp-user@example.test', otp: '012345' });
    expect(result.status).toBe(200);
    expect(result.body.user.hasPassword).toBe(false);
    expect(gateway.verifyOtp).toHaveBeenCalledWith('otp-user@example.test', '012345');
  });
  it('does not issue a session for a rejected code', async () => {
    const response = await request(app).post('/api/auth/otp/verify').send({ email: 'otp-user@example.test', otp: '999999' });
    expect(response.status).toBe(400); expect(response.body.token).toBeUndefined();
  });
  it('requires authenticated ownership to send a deletion code', async () => {
    expect((await request(app).post('/api/auth/delete-code').send({ email: 'other@example.test' })).status).toBe(401);
    const signed = await request(app).post('/api/auth/otp/verify').send({ email: 'delete@example.test', otp: '012345' });
    const auth = { Authorization: `Bearer ${signed.body.token}` };
    await request(app).post('/api/auth/delete-code').set(auth).send({ email: 'other@example.test' });
    expect(gateway.sendOtp).toHaveBeenLastCalledWith('delete@example.test');
    expect((await request(app).delete('/api/auth/me').set(auth).send({ otp: '999999' })).status).toBe(400);
    expect((await request(app).delete('/api/auth/me').set(auth).send({ otp: '012345' })).status).toBe(204);
    expect((await request(app).get('/api/auth/me').set(auth)).status).toBe(401);
    const recreated = await request(app).post('/api/auth/otp/verify').send({ email: 'delete@example.test', otp: '012345' });
    expect(recreated.status).toBe(403);
    expect(recreated.body.error.code).toBe('account_deleted');
  });
  it('does not delete a customer when the provider returns a different identity', async () => {
    const signed = await exchange(identity('google-only', 'different@example.test'));
    const response = await request(app).delete('/api/auth/me').set('Authorization', `Bearer ${signed.body.token}`).send({ otp: '012345' });
    expect(response.status).toBe(403);
    expect((await db.query('SELECT id FROM users WHERE id = $1', [signed.body.user.id])).length).toBe(1);
  });
  it('allows a new customer to complete their profile', async () => {
    const signed = await exchange(identity('profile'));
    const saved = await request(app).patch('/api/auth/me').set('Authorization', `Bearer ${signed.body.token}`).send({ firstName: 'Ana', lastName: 'Reyes', phone: '09171234567' });
    expect(saved.status).toBe(200);
    expect(saved.body.user).toMatchObject({ firstName: 'Ana', lastName: 'Reyes' });
  });
});

describe('actual JWT cryptography', () => {
  it('checks signature, issuer, audience, expiration, verification and ban state', async () => {
    const pair = await generateKeyPair('EdDSA');
    const jwk = { ...await exportJWK(pair.publicKey), kid: 'test-key', alg: 'EdDSA' };
    const verify = createNeonVerifier(base, createLocalJWKSet({ keys: [jwk] }));
    async function token(overrides: Record<string, unknown> = {}) {
      return new SignJWT({ sub: 'customer', email: 'customer@example.test', emailVerified: true, name: 'Customer', iss: issuer, aud: issuer, iat: Math.floor(Date.now()/1000), exp: Math.floor(Date.now()/1000)+300, ...overrides })
        .setProtectedHeader({ alg: 'EdDSA', kid: 'test-key' }).sign(pair.privateKey);
    }
    expect((await verify(await token())).subject).toBe('customer');
    for (const claims of [{ iss: 'https://attacker.test' }, { aud: 'wrong-audience' }, { exp: 1 }, { emailVerified: false }, { banned: true }, { sub: '' }]) {
      await expect(verify(await token(claims))).rejects.toMatchObject({ code: 'invalid_neon_proof' });
    }
    await expect(verify('not-a-jwt')).rejects.toMatchObject({ code: 'invalid_neon_proof' });
    const other = await generateKeyPair('EdDSA');
    const forged = await new SignJWT({ sub: 'customer', email: 'customer@example.test', emailVerified: true })
      .setProtectedHeader({ alg: 'EdDSA', kid: 'test-key' }).setIssuer(issuer).setAudience(issuer).setIssuedAt().setExpirationTime('5m').sign(other.privateKey);
    await expect(verify(forged)).rejects.toMatchObject({ code: 'invalid_neon_proof' });
  });
});
