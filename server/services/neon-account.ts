import jwt from 'jsonwebtoken';
import type { AppContext } from '../context';
import type { Row } from '../db';
import { HttpError } from '../lib/errors';
import { checkPassword } from '../lib/security';
import { identitySchema, type NeonIdentity } from '../lib/neon-auth';

const deleted = () => new HttpError(403, 'This ScenTop account was deleted. Contact support before registering this identity again.', 'account_deleted');

function linkRequired(identity: NeonIdentity, secret: string): never {
  const linkTicket = jwt.sign({ identity, purpose: 'link-neon' }, secret, {
    algorithm: 'HS256', expiresIn: '5m', audience: 'scentop-account-link', issuer: 'scentop',
  });
  throw new HttpError(409, 'An account already uses this email. Enter its ScenTop password to link your sign-in.', 'account_link_required', { linkTicket });
}

export function readLinkTicket(ticket: string, secret: string): NeonIdentity {
  try {
    const claims = jwt.verify(ticket, secret, { algorithms: ['HS256'], audience: 'scentop-account-link', issuer: 'scentop' });
    if (typeof claims === 'string' || claims.purpose !== 'link-neon') throw new Error('Wrong purpose');
    return identitySchema.parse(claims.identity);
  } catch {
    throw new HttpError(400, 'This linking request expired. Sign in with Google or a new email code again.', 'link_expired');
  }
}

export async function resolveNeonAccount(ctx: AppContext, identity: NeonIdentity, password?: string): Promise<Row> {
  // Retry once after a uniqueness race. Both user + mapping writes are atomic.
  for (let attempt = 0; ; attempt++) {
    try {
      return await ctx.db.tx(async q => {
        if (ctx.db.kind === 'postgres') await q.query('SELECT pg_advisory_xact_lock(hashtext($1))', [identity.email.toLowerCase()]);
        const [mapping] = await q.query('SELECT user_id FROM user_auth_identities WHERE issuer = $1 AND subject = $2 FOR UPDATE', [identity.issuer, identity.subject]);
        if (mapping) {
          if (mapping.user_id === null) throw deleted();
          const [user] = await q.query('SELECT * FROM users WHERE id = $1', [mapping.user_id]);
          if (!user) throw deleted();
          return user;
        }
        const [existing] = await q.query('SELECT * FROM users WHERE lower(email) = lower($1) FOR UPDATE', [identity.email]);
        if (existing) {
          if (password === undefined) linkRequired(identity, ctx.config.jwtSecret);
          if (!existing.password_hash || !(await checkPassword(password, existing.password_hash))) {
            throw new HttpError(400, 'Could not link this account. Check your existing ScenTop password.', 'invalid_link_password');
          }
          await q.query('INSERT INTO user_auth_identities (issuer, subject, user_id) VALUES ($1, $2, $3)', [identity.issuer, identity.subject, existing.id]);
          return existing;
        }
        // A link ticket must not recreate an account removed after it was issued.
        if (password !== undefined) throw new HttpError(409, 'The original account no longer exists. Start sign-in again.', 'account_missing');
        const [user] = await q.query(`INSERT INTO users (email, password_hash, first_name, last_name)
          VALUES ($1, NULL, '', '') RETURNING *`, [identity.email.toLowerCase()]);
        await q.query('INSERT INTO user_auth_identities (issuer, subject, user_id) VALUES ($1, $2, $3)', [identity.issuer, identity.subject, user.id]);
        return user;
      });
    } catch (error) {
      if (attempt === 0 && (error as { code?: string }).code === '23505') continue;
      throw error;
    }
  }
}
