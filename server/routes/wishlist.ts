import { Router } from 'express';
import { z } from 'zod';
import type { AppContext } from '../context';
import { notFound } from '../lib/errors';
import { parse, schemas } from '../lib/validate';
import { currentUser, requireAuth } from '../middleware/auth';
import { wishlistProducts } from '../services/catalogue';

export function wishlistRouter(ctx: AppContext): Router {
  const router = Router();
  router.use('/wishlist', requireAuth(ctx));

  router.get('/wishlist', async (req, res) => {
    res.json(await wishlistProducts(ctx.db, currentUser(req).id));
  });

  // Saving something that is already saved is fine
  router.put('/wishlist/:productId', async (req, res) => {
    const userId = currentUser(req).id;
    const productId = parse(schemas.id, req.params.productId);

    const rows = await ctx.db.query(
      `INSERT INTO wishlist_items (user_id, product_id)
       SELECT $1::int, p.id FROM products p WHERE p.id = $2::int
       ON CONFLICT DO NOTHING RETURNING product_id`,
      [userId, productId],
    );
    if (rows.length === 0) {
      const exists = await ctx.db.query('SELECT 1 FROM products WHERE id = $1', [productId]);
      if (exists.length === 0) throw notFound('We could not find that perfume.');
    }
    res.json(await wishlistProducts(ctx.db, userId));
  });

  router.delete('/wishlist/:productId', async (req, res) => {
    const userId = currentUser(req).id;
    await ctx.db.query('DELETE FROM wishlist_items WHERE user_id = $1 AND product_id = $2', [
      userId,
      parse(schemas.id, req.params.productId),
    ]);
    res.json(await wishlistProducts(ctx.db, userId));
  });

  // Called right after login: moves what a guest saved on this device into their account
  router.post('/wishlist/merge', async (req, res) => {
    const { productIds } = parse(z.object({ productIds: z.array(schemas.id).max(200) }), req.body);
    const userId = currentUser(req).id;

    await ctx.db.query(
      `INSERT INTO wishlist_items (user_id, product_id)
       SELECT $1::int, p.id FROM products p WHERE p.id = ANY($2::int[])
       ON CONFLICT DO NOTHING`,
      [userId, productIds],
    );
    res.json(await wishlistProducts(ctx.db, userId));
  });

  return router;
}
