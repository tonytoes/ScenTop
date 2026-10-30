import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from 'jose';
import { z } from 'zod';
import type { Config } from '../config';
import { HttpError } from './errors';

export const identitySchema = z.object({
  issuer: z.string().url(),
  subject: z.string().min(1).max(500),
  email: z.email().max(254),
  name: z.string().max(500),
});
export type NeonIdentity = z.infer<typeof identitySchema>;
export interface NeonGateway {
  verify(token: string): Promise<NeonIdentity>;
  sendOtp(email: string): Promise<void>;
  verifyOtp(email: string, otp: string): Promise<NeonIdentity>;
}

// Error codes returned by Neon Auth's email OTP endpoints, turned into messages a customer can act on.
const OTP_ERRORS: Record<string, string> = {
  INVALID_OTP: 'That code is incorrect. Check the latest email and try again.',
  OTP_EXPIRED: 'That code has expired. Request a new one.',
  TOO_MANY_ATTEMPTS: 'Too many wrong codes. Request a new one.',
  INVALID_EMAIL: 'Enter a valid email address.',
};

export function createNeonVerifier(base: string, key?: JWTVerifyGetKey) {
  const origin = new URL(base).origin;
  const jwks = key ?? createRemoteJWKSet(new URL(`${base}/.well-known/jwks.json`));
  return async (token: string): Promise<NeonIdentity> => {
    try {
      const { payload } = await jwtVerify(token, jwks, {
        issuer: origin, audience: origin, algorithms: ['EdDSA'],
        requiredClaims: ['sub', 'iat', 'exp'], clockTolerance: 5,
      });
      if (payload.emailVerified !== true || payload.banned === true) throw new Error('Unverified identity');
      return identitySchema.parse({ issuer: origin, subject: payload.sub, email: payload.email, name: payload.name ?? '' });
    } catch {
      // 400 avoids treating a failed external proof as an expired ScenTop session.
      throw new HttpError(400, 'Your sign-in could not be verified. Please try again.', 'invalid_neon_proof');
    }
  };
}

export function createNeonGateway(config: Config): NeonGateway {
  const base = config.neonAuthBaseUrl;
  if (!base) {
    const disabled = async (): Promise<never> => { throw new HttpError(503, 'Passwordless login is not configured yet.', 'auth_not_configured'); };
    return { verify: disabled, sendOtp: disabled, verifyOtp: disabled };
  }
  const issuer = new URL(base).origin;
  async function post(path: string, body: unknown): Promise<unknown> {
    let response: Response;
    try {
      response = await fetch(`${base}${path}`, {
        method: 'POST', redirect: 'error', signal: AbortSignal.timeout(15000),
        headers: { 'Content-Type': 'application/json', Origin: config.authAppOrigin! },
        body: JSON.stringify(body),
      });
    } catch {
      throw new HttpError(503, 'The email sign-in service is unavailable. Please try again.', 'auth_unavailable');
    }
    if (!response.ok) {
      if (response.status === 429) throw new HttpError(429, 'Too many attempts. Wait before requesting another code.', 'rate_limited');
      const code = await response.json().then((body: { code?: unknown }) => body?.code, () => undefined);
      throw new HttpError(400, typeof code === 'string' && OTP_ERRORS[code] || 'The code could not be sent or verified. Check the code or request a new one.', 'otp_failed');
    }
    return response.json();
  }
  return {
    verify: createNeonVerifier(base),
    async sendOtp(email) {
      await post('/email-otp/send-verification-otp', { email, type: 'sign-in' });
    },
    async verifyOtp(email, otp) {
      // Server-to-server verification consumes the OTP. Never trust a browser
      // assertion that a code was valid. No provider session token is returned.
      const result = z.object({ user: z.object({
        id: z.string().min(1), email: z.email(), emailVerified: z.literal(true),
        name: z.string().optional(), banned: z.boolean().optional(),
      }) }).safeParse(await post('/sign-in/email-otp', { email, otp }));
      if (!result.success || result.data.user.banned || result.data.user.email.toLowerCase() !== email.toLowerCase()) {
        throw new HttpError(400, 'Your email could not be verified.', 'otp_failed');
      }
      return identitySchema.parse({ issuer, subject: result.data.user.id, email: result.data.user.email, name: result.data.user.name ?? '' });
    },
  };
}
