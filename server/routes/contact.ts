import { Router } from 'express';
import { z } from 'zod';
import type { AppContext } from '../context';
import { parse, schemas } from '../lib/validate';

const contactSchema = z.object({
  name: schemas.name('Name'),
  email: schemas.email,
  message: schemas.required('Message').min(10, 'Please write at least 10 characters.').max(2000, 'Your message is too long.'),
});

export function contactRouter(ctx: AppContext): Router {
  const router = Router();

  router.post('/contact', async (req, res) => {
    const input = parse(contactSchema, req.body);
    await ctx.db.query('INSERT INTO contact_messages (name, email, message) VALUES ($1, $2, $3)', [
      input.name,
      input.email,
      input.message,
    ]);
    res.status(201).json({ ok: true });
  });

  return router;
}
