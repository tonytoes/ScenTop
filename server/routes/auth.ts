import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import type { AppContext } from '../context';
import { toUser } from '../lib/dto';
import { conflict, HttpError } from '../lib/errors';
import { checkPassword, hashPassword, signToken } from '../lib/security';
import { parse, schemas } from '../lib/validate';
import { currentUser, requireAuth } from '../middleware/auth';

const isUniqueViolation = (error: unknown) => (error as { code?: string })?.code === '23505';

const signupSchema = z.object({
  firstName: schemas.name('First name'),
  lastName: schemas.name('Last name'),
  email: schemas.email,
  phone: schemas.phone,
  password: schemas.password,
});

const loginSchema = z.object({
  email: schemas.email,
  password: schemas.required('Password'),
});

// A profile picture is a small resized image sent as a data URL (see the profile page).
const photoSchema = z
  .string()
  .max(150_000, 'That picture is too large.')
  .refine((value) => /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(value), 'Choose a PNG, JPG or WebP picture.')
  .nullable();

const profileSchema = z
  .object({
    firstName: schemas.name('First name'),
    lastName: schemas.name('Last name'),
    phone: schemas.phone,
    address: z.string().trim().max(300, 'Address is too long.'),
    photoUrl: photoSchema,
  })
  .partial();

const passwordChangeSchema = z.object({
  currentPassword: schemas.required('Current password'),
  newPassword: schemas.password,
});

const deleteSchema = z.object({ password: schemas.required('Password') });

export function authRouter(ctx: AppContext): Router {
  const router = Router();
  const auth = requireAuth(ctx);
  // Compared against when the e-mail is unknown, so a wrong e-mail and a wrong password take equally long
  const dummyHash = bcrypt.hashSync('not-a-real-password', ctx.config.bcryptRounds);

  const session = (row: Parameters<typeof toUser>[0]) => ({ token: signToken(row.id, ctx.config.jwtSecret), user: toUser(row) });

  router.post('/signup', async (req, res) => {
    const input = parse(signupSchema, req.body);
    const passwordHash = await hashPassword(input.password, ctx.config.bcryptRounds);

    try {
      const [user] = await ctx.db.query(
        `INSERT INTO users (email, password_hash, first_name, last_name, phone)
         VALUES ($1, $2, $3, $4, $5) RETURNING *`,
        [input.email, passwordHash, input.firstName, input.lastName, input.phone],
      );
      res.status(201).json(session(user!));
    } catch (error) {
      if (isUniqueViolation(error)) throw conflict('An account with this e-mail already exists.');
      throw error;
    }
  });

  router.post('/login', async (req, res) => {
    const input = parse(loginSchema, req.body);
    const [user] = await ctx.db.query('SELECT * FROM users WHERE lower(email) = lower($1)', [input.email]);

    const passwordOk = await checkPassword(input.password, user?.password_hash ?? dummyHash);
    if (!user || !passwordOk) throw new HttpError(401, 'Incorrect e-mail or password.', 'invalid_credentials');

    res.json(session(user));
  });

  router.get('/me', auth, (req, res) => {
    res.json({ user: toUser(currentUser(req)) });
  });

  router.patch('/me', auth, async (req, res) => {
    const input = parse(profileSchema, req.body);
    const current = currentUser(req);

    const [user] = await ctx.db.query(
      `UPDATE users SET first_name = $2, last_name = $3, phone = $4, address = $5, photo_url = $6, updated_at = now()
       WHERE id = $1 RETURNING *`,
      [
        current.id,
        input.firstName ?? current.first_name,
        input.lastName ?? current.last_name,
        input.phone ?? current.phone,
        input.address ?? current.address,
        input.photoUrl === undefined ? current.photo_url : input.photoUrl,
      ],
    );
    res.json({ user: toUser(user!) });
  });

  router.post('/change-password', auth, async (req, res) => {
    const input = parse(passwordChangeSchema, req.body);
    const current = currentUser(req);

    if (!(await checkPassword(input.currentPassword, current.password_hash))) {
      throw new HttpError(400, 'Your current password is incorrect.', 'validation', {
        currentPassword: 'Your current password is incorrect.',
      });
    }
    const passwordHash = await hashPassword(input.newPassword, ctx.config.bcryptRounds);
    await ctx.db.query('UPDATE users SET password_hash = $2, updated_at = now() WHERE id = $1', [current.id, passwordHash]);
    res.status(204).end();
  });

  // Apps that let people create an account must also let them delete it (Google Play / App Store rule)
  router.delete('/me', auth, async (req, res) => {
    const input = parse(deleteSchema, req.body);
    const current = currentUser(req);

    if (!(await checkPassword(input.password, current.password_hash))) {
      throw new HttpError(400, 'That password is incorrect.', 'validation', { password: 'That password is incorrect.' });
    }

    await ctx.db.tx(async (q) => {
      // Orders are kept for the shop's records, but without the customer's personal details
      await q.query(`UPDATE orders SET ship_name = 'Deleted account', ship_phone = '', ship_address = '' WHERE user_id = $1`, [current.id]);
      await q.query('DELETE FROM users WHERE id = $1', [current.id]);
    });
    res.status(204).end();
  });

  return router;
}
