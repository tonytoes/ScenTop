import { Router } from 'express';
import { z } from 'zod';
import type { AppContext } from '../context';
import { notFound } from '../lib/errors';
import { parse, schemas } from '../lib/validate';
import { currentUser, requireAuth } from '../middleware/auth';
import { addToCart, getCart, lineSchema, previewCart, quantitySchema } from '../services/cart';

const linesSchema = z.object({ items: z.array(lineSchema).max(100) });
const addSchema = z.object({
  variantId: schemas.id,
  quantity: quantitySchema.default(1),
});

export function cartRouter(ctx: AppContext): Router {
  const router = Router();
  const auth = requireAuth(ctx);

  // Guests keep their cart on their device; this only prices it. It needs no login.
  router.post('/cart/preview', async (req, res) => {
    res.json(await previewCart(ctx.db, parse(linesSchema, req.body).items));
  });

  router.use('/cart', auth);

  router.get('/cart', async (req, res) => {
    res.json(await getCart(ctx.db, currentUser(req).id));
  });

  router.post('/cart/items', async (req, res) => {
    const input = parse(addSchema, req.body);
    const userId = currentUser(req).id;
    if (!(await addToCart(ctx.db, userId, input.variantId, input.quantity))) throw notFound('That perfume size is not available.');
    res.json(await getCart(ctx.db, userId));
  });

  router.patch('/cart/items/:variantId', async (req, res) => {
    const variantId = parse(schemas.id, req.params.variantId);
    const { quantity } = parse(z.object({ quantity: quantitySchema }), req.body);
    const userId = currentUser(req).id;

    const rows = await ctx.db.query(
      'UPDATE cart_items SET quantity = $3 WHERE user_id = $1 AND variant_id = $2 RETURNING variant_id',
      [userId, variantId, quantity],
    );
    if (rows.length === 0) throw notFound('That item is not in your cart.');
    res.json(await getCart(ctx.db, userId));
  });

  router.delete('/cart/items/:variantId', async (req, res) => {
    const userId = currentUser(req).id;
    await ctx.db.query('DELETE FROM cart_items WHERE user_id = $1 AND variant_id = $2', [
      userId,
      parse(schemas.id, req.params.variantId),
    ]);
    res.json(await getCart(ctx.db, userId));
  });

  router.delete('/cart', async (req, res) => {
    const userId = currentUser(req).id;
    await ctx.db.query('DELETE FROM cart_items WHERE user_id = $1', [userId]);
    res.json(await getCart(ctx.db, userId));
  });

  // Called right after login: moves what a guest put in their cart on this device into their account
  router.post('/cart/merge', async (req, res) => {
    const { items } = parse(linesSchema, req.body);
    const userId = currentUser(req).id;
    await ctx.db.tx(async (q) => {
      for (const item of items) await addToCart(q, userId, item.variantId, item.quantity);
    });
    res.json(await getCart(ctx.db, userId));
  });

  return router;
}
