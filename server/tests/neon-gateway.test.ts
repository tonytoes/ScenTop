import { afterEach, describe, expect, it, vi } from 'vitest';
import { loadConfig } from '../config';
import { createNeonGateway } from '../lib/neon-auth';

const config = loadConfig({ NODE_ENV: 'test', NEON_AUTH_BASE_URL: 'https://auth.example.test/neondb/auth', AUTH_APP_ORIGIN: 'http://localhost:4200' });
afterEach(() => vi.unstubAllGlobals());

describe('managed OTP HTTP contract', () => {
  it('uses a fixed trusted upstream and server-configured Origin', async () => {
    const fetcher = vi.fn(async () => new Response(JSON.stringify({ success: true }), { status: 200 }));
    vi.stubGlobal('fetch', fetcher);
    await createNeonGateway(config).sendOtp('customer@example.test');
    expect(fetcher).toHaveBeenCalledWith('https://auth.example.test/neondb/auth/email-otp/send-verification-otp', expect.objectContaining({
      method: 'POST', redirect: 'error',
      headers: { 'Content-Type': 'application/json', Origin: 'http://localhost:4200' },
      body: JSON.stringify({ email: 'customer@example.test', type: 'sign-in' }),
    }));
  });
  it('accepts only a verified provider response for the requested email', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ token: 'never-return-this', user: { id: 'provider-id', email: 'customer@example.test', emailVerified: true, name: 'Customer' } }), { status: 200 })));
    const result = await createNeonGateway(config).verifyOtp('customer@example.test', '012345');
    expect(result).toEqual({ issuer: 'https://auth.example.test', subject: 'provider-id', email: 'customer@example.test', name: 'Customer' });
    expect(JSON.stringify(result)).not.toContain('never-return-this');
    await expect(createNeonGateway(config).verifyOtp('different@example.test', '012345')).rejects.toMatchObject({ code: 'otp_failed' });
  });
  it('rejects unverified, banned, malformed, and rate-limited responses', async () => {
    for (const user of [{ id: 'id', email: 'a@example.test', emailVerified: false }, { id: 'id', email: 'a@example.test', emailVerified: true, banned: true }, {}]) {
      vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ user }), { status: 200 })));
      await expect(createNeonGateway(config).verifyOtp('a@example.test', '012345')).rejects.toMatchObject({ code: 'otp_failed' });
    }
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 429 })));
    await expect(createNeonGateway(config).sendOtp('a@example.test')).rejects.toMatchObject({ status: 429 });
  });
  it('explains provider OTP errors', async () => {
    for (const [code, status, message] of [['INVALID_OTP', 400, /incorrect/], ['OTP_EXPIRED', 400, /expired/], ['TOO_MANY_ATTEMPTS', 403, /Too many/], ['SOMETHING_ELSE', 400, /could not be sent/]] as const) {
      vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ code }), { status })));
      await expect(createNeonGateway(config).verifyOtp('a@example.test', '012345')).rejects.toMatchObject({ status: 400, code: 'otp_failed', message: expect.stringMatching(message) });
    }
    vi.stubGlobal('fetch', vi.fn(async () => new Response('not json', { status: 500 })));
    await expect(createNeonGateway(config).sendOtp('a@example.test')).rejects.toMatchObject({ code: 'otp_failed' });
  });
  it('leaves passwordless routes disabled without configuration', async () => {
    const disabled = createNeonGateway(loadConfig({ NODE_ENV: 'test' }));
    await expect(disabled.sendOtp('a@example.test')).rejects.toMatchObject({ code: 'auth_not_configured' });
  });
});
