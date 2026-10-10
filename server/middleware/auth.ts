import type { Request, RequestHandler } from 'express';
import type { AppContext } from '../context';
import { unauthorized } from '../lib/errors';
import { readToken } from '../lib/security';
import type { Row } from '../db';

declare global {
  namespace Express {
    interface Request {
      /** The logged-in user's database row. Set by requireAuth. */
      user?: Row;
    }
  }
}

/** Rejects the request unless it carries a valid `Authorization: Bearer <token>` header. */
export function requireAuth(ctx: AppContext): RequestHandler {
  return async (req, _res, next) => {
    const header = req.headers.authorization ?? '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : '';
    const userId = token ? readToken(token, ctx.config.jwtSecret) : null;
    if (userId === null) throw unauthorized();

    const [user] = await ctx.db.query('SELECT * FROM users WHERE id = $1', [userId]);
    if (!user) throw unauthorized('This account no longer exists.');

    req.user = user;
    next();
  };
}

/** The logged-in user. Only call inside a route that uses requireAuth. */
export function currentUser(req: Request): Row {
  if (!req.user) throw unauthorized();
  return req.user;
}
