import { Router } from 'express';
import { z } from 'zod';
import type { AppContext } from '../context';
import { notFound } from '../lib/errors';
import { parse } from '../lib/validate';
import { currentUser, requireAuth } from '../middleware/auth';
import { categoryCounts, getProduct, listProducts, listQuerySchema } from '../services/catalogue';

const reviewSchema = z.object({
  rating: z.coerce.number({ error: 'Choose a rating.' }).int().min(1, 'Choose a rating.').max(5, 'Choose a rating.'),
  comment: z.string().trim().max(1000, 'Your review is too long.').default(''),
});

export function productsRouter(ctx: AppContext): Router {
  const router = Router();
  const auth = requireAuth(ctx);

  router.get('/products', async (req, res) => {
    res.json(await listProducts(ctx.db, parse(listQuerySchema, req.query)));
  });

  router.get('/categories', async (_req, res) => {
    res.json(await categoryCounts(ctx.db));
  });

  router.get('/products/:idOrSlug', async (req, res) => {
    res.json(await getProduct(ctx.db, req.params.idOrSlug));
  });

  router.get('/products/:idOrSlug/reviews', async (req, res) => {
    const product = await getProduct(ctx.db, req.params.idOrSlug);
    const rows = await ctx.db.query(
      `SELECT r.id, r.rating, r.comment, r.created_at, u.first_name, u.last_name
       FROM reviews r JOIN users u ON u.id = r.user_id
       WHERE r.product_id = $1 ORDER BY r.created_at DESC LIMIT 50`,
      [product.id],
    );
    res.json(
      rows.map((row) => ({
        id: row.id,
        rating: row.rating,
        comment: row.comment,
        createdAt: row.created_at,
        author: `${row.first_name} ${String(row.last_name).charAt(0)}.`,
      })),
    );
  });

  // Posting again replaces the customer's earlier review of the same perfume
  router.post('/products/:idOrSlug/reviews', auth, async (req, res) => {
    const input = parse(reviewSchema, req.body);
    const product = await getProduct(ctx.db, String(req.params.idOrSlug)).catch(() => {
      throw notFound('We could not find that perfume.');
    });

    await ctx.db.query(
      `INSERT INTO reviews (product_id, user_id, rating, comment) VALUES ($1, $2, $3, $4)
       ON CONFLICT (product_id, user_id) DO UPDATE SET rating = EXCLUDED.rating, comment = EXCLUDED.comment, created_at = now()`,
      [product.id, currentUser(req).id, input.rating, input.comment],
    );
    res.status(201).json(await getProduct(ctx.db, String(product.id)));
  });

  return router;
}
