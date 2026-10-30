import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const TOKEN_LIFETIME = '30d';

export const hashPassword = (password: string, rounds: number) => bcrypt.hash(password, rounds);
export const checkPassword = (password: string, hash: string) => bcrypt.compare(password, hash);

export function signToken(userId: number, secret: string): string {
  return jwt.sign({ sub: String(userId) }, secret, { algorithm: 'HS256', expiresIn: TOKEN_LIFETIME });
}

/** Returns the user id inside a valid token, or null for a bad or expired one. */
export function readToken(token: string, secret: string): number | null {
  try {
    const payload = jwt.verify(token, secret, { algorithms: ['HS256'] });
    const id = Number(typeof payload === 'string' ? NaN : payload.sub);
    return Number.isInteger(id) ? id : null;
  } catch {
    return null;
  }
}
