import { Router } from 'express';
import { z } from 'zod';
import type { AppContext } from '../context';
import type { Queryable, Row } from '../db';
import { orderNumber, toUser } from '../lib/dto';
import { badRequest, conflict, notFound } from '../lib/errors';
import { parse, schemas } from '../lib/validate';
import { currentUser, requireAdmin } from '../middleware/auth';
import { ANALYTICS_RANGES, dashboard } from '../services/analytics';
import { categories } from '../services/catalogue';
import { ORDER_STATUSES, withItems } from '../services/orders';

const isUniqueViolation = (error: unknown) => (error as { code?: string })?.code === '23505';
const likePattern = (text: string) => `%${text.replace(/[\\%_]/g, '\\$&')}%`;

const pageSchema = {
  q: z.string().trim().max(80).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  offset: z.coerce.number().int().min(0).default(0),
};

const usersQuerySchema = z.object({
  ...pageSchema,
  role: z.enum(['customer', 'admin']).optional(),
  sort: z.enum(['newest', 'oldest', 'spent', 'orders', 'name']).default('newest'),
});

const USER_SORTS = {
  newest: 'u.created_at DESC',
  oldest: 'u.created_at ASC',
  spent: 'spent DESC, u.id',
  orders: 'order_count DESC, u.id',
  name: 'u.first_name, u.last_name',
} as const;

const userUpdateSchema = z
  .object({
    role: z.enum(['customer', 'admin']),
    isDisabled: z.boolean(),
    firstName: schemas.name('First name'),
    lastName: schemas.name('Last name'),
    phone: z.string().trim().max(20),
    address: z.string().trim().max(300, 'Address is too long.'),
  })
  .partial();

const ordersQuerySchema = z.object({
  ...pageSchema,
  status: z.enum(ORDER_STATUSES).optional(),
  userId: z.coerce.number().int().positive().optional(),
});

const orderUpdateSchema = z.object({ status: z.enum(ORDER_STATUSES, { error: 'Choose a status.' }) });

// A product picture can be a file in the app (assets/...), a web address, or an uploaded image
const imageSchema = z
  .string({ error: 'Add a picture.' })
  .trim()
  .min(1, 'Add a picture.')
  .max(1_500_000, 'That picture is too large.')
  .refine(
    (value) => /^assets\/[\w\-./]+$/.test(value) || /^https:\/\/\S+$/.test(value) || /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(value),
    'Use a picture from the app, an https:// link, or upload a PNG, JPG or WebP.',
  );

const productSchema = z.object({
  name: schemas.required('Name').max(80, 'Name is too long.'),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'Use lowercase letters, numbers and dashes.')
    .max(80)
    .optional()
    .or(z.literal('').transform(() => undefined)),
  category: z.enum(categories, { error: 'Choose a category.' }),
  audience: z.enum(['women', 'men', 'unisex'], { error: 'Choose who it is for.' }),
  description: schemas.required('Description').max(1000, 'Description is too long.'),
  scentNotes: z.array(z.string().trim().min(1).max(40)).max(12).default([]),
  imageUrl: imageSchema,
  isBestSeller: z.boolean().default(false),
  isNewArrival: z.boolean().default(false),
  isActive: z.boolean().default(true),
  variants: z
    .array(
      z.object({
        sizeMl: z.coerce.number().int().min(1, 'Size must be at least 1 ml.').max(1000),
        priceCents: z.coerce.number().int().min(0, 'Price cannot be negative.').max(100_000_000),
      }),
    )
    .min(1, 'Add at least one bottle size.')
    .max(6)
    .refine((list) => new Set(list.map((v) => v.sizeMl)).size === list.length, 'Each bottle size can only be listed once.'),
});
type ProductInput = z.infer<typeof productSchema>;

const slugify = (name: string) =>
  name
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || 'perfume';

// Totals are grouped once and joined, rather than counted again for every perfume
const ADMIN_PRODUCT_SQL = `
  WITH sales AS (
    SELECT oi.product_id, sum(oi.quantity)::int AS units, sum(oi.quantity * oi.unit_price_cents)::int AS revenue
    FROM order_items oi JOIN orders o ON o.id = oi.order_id
    WHERE o.status <> 'cancelled' GROUP BY oi.product_id
  ),
  rated AS (SELECT product_id, avg(rating)::float8 AS avg, count(*)::int AS count FROM reviews GROUP BY product_id),
  wished AS (SELECT product_id, count(*)::int AS count FROM wishlist_items GROUP BY product_id)
  SELECT p.*,
    COALESCE(rated.avg, 0) AS rating_avg, COALESCE(rated.count, 0) AS rating_count, COALESCE(wished.count, 0) AS wish_count,
    COALESCE(sales.units, 0) AS units_sold, COALESCE(sales.revenue, 0) AS revenue
  FROM products p
  LEFT JOIN sales ON sales.product_id = p.id
  LEFT JOIN rated ON rated.product_id = p.id
  LEFT JOIN wished ON wished.product_id = p.id`;

async function adminProducts(q: Queryable, id?: number) {
  const rows = await q.query(`${ADMIN_PRODUCT_SQL} ${id ? 'WHERE p.id = $1' : ''} ORDER BY p.name`, id ? [id] : []);
  const variants = rows.length
    ? await q.query('SELECT id, product_id, size_ml, price_cents FROM product_variants WHERE product_id = ANY($1::int[]) ORDER BY size_ml', [rows.map((r) => r.id)])
    : [];
  return rows.map((row) => ({
    id: row.id,
    slug: row.slug,
    name: row.name,
    category: row.category,
    audience: row.audience,
    description: row.description,
    scentNotes: row.scent_notes,
    imageUrl: row.image_url,
    isBestSeller: row.is_best_seller,
    isNewArrival: row.is_new_arrival,
    isActive: row.is_active,
    createdAt: row.created_at,
    ratingAvg: Math.round(row.rating_avg * 10) / 10,
    ratingCount: row.rating_count,
    wishCount: row.wish_count,
    unitsSold: row.units_sold,
    revenueCents: row.revenue,
    variants: variants.filter((v) => v.product_id === row.id).map((v) => ({ id: v.id, sizeMl: v.size_ml, priceCents: v.price_cents })),
  }));
}

/** Saves a product's bottle sizes: updates prices, adds new sizes and removes sizes no longer listed. */
async function saveVariants(q: Queryable, productId: number, variants: ProductInput['variants']) {
  await q.query('DELETE FROM product_variants WHERE product_id = $1 AND NOT (size_ml = ANY($2::int[]))', [productId, variants.map((v) => v.sizeMl)]);
  for (const variant of variants) {
    await q.query(
      `INSERT INTO product_variants (product_id, size_ml, price_cents) VALUES ($1, $2, $3)
       ON CONFLICT (product_id, size_ml) DO UPDATE SET price_cents = EXCLUDED.price_cents`,
      [productId, variant.sizeMl, variant.priceCents],
    );
  }
}

const productValues = (input: ProductInput) => [
  input.slug ?? slugify(input.name),
  input.name,
  input.category,
  input.audience,
  input.description,
  input.scentNotes,
  input.imageUrl,
  input.isBestSeller,
  input.isNewArrival,
  input.isActive,
];

const toAdminUser = (row: Row) => ({
  ...toUser(row),
  isDisabled: row.is_disabled,
  createdAt: row.created_at,
  orderCount: row.order_count ?? 0,
  totalSpentCents: row.spent ?? 0,
  lastOrderAt: row.last_order_at ?? null,
});

const USER_STATS_SQL = `
  SELECT u.*,
    (SELECT count(*) FROM orders o WHERE o.user_id = u.id AND o.status <> 'cancelled')::int AS order_count,
    COALESCE((SELECT sum(total_cents) FROM orders o WHERE o.user_id = u.id AND o.status <> 'cancelled'), 0)::int AS spent,
    (SELECT max(created_at) FROM orders o WHERE o.user_id = u.id) AS last_order_at
  FROM users u`;

export function adminRouter(ctx: AppContext): Router {
  const router = Router();
  router.use(requireAdmin(ctx));

  // ---- Dashboard ------------------------------------------------------------------------------
  router.get('/analytics', async (req, res) => {
    const { days } = parse(z.object({ days: z.coerce.number().pipe(z.union(ANALYTICS_RANGES.map((d) => z.literal(d)))).default(30) }), req.query);
    res.json(await dashboard(ctx.db, days));
  });

  // ---- Customers ------------------------------------------------------------------------------
  router.get('/users', async (req, res) => {
    const query = parse(usersQuerySchema, req.query);
    const params: unknown[] = [];
    const where: string[] = [];
    const add = (value: unknown) => `$${params.push(value)}`;

    if (query.q) {
      const pattern = add(likePattern(query.q));
      where.push(`(u.email ILIKE ${pattern} OR (u.first_name || ' ' || u.last_name) ILIKE ${pattern} OR u.phone ILIKE ${pattern})`);
    }
    if (query.role) where.push(`u.role = ${add(query.role)}`);
    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

    const [{ total }] = (await ctx.db.query(`SELECT count(*)::int AS total FROM users u ${whereSql}`, params)) as [{ total: number }];
    const rows = await ctx.db.query(
      `SELECT * FROM (${USER_STATS_SQL} ${whereSql}) u ORDER BY ${USER_SORTS[query.sort]} LIMIT ${add(query.limit)} OFFSET ${add(query.offset)}`,
      params,
    );
    res.json({ items: rows.map(toAdminUser), total });
  });

  router.get('/users/:id', async (req, res) => {
    const id = parse(schemas.id, req.params.id);
    const [row] = await ctx.db.query(`${USER_STATS_SQL} WHERE u.id = $1`, [id]);
    if (!row) throw notFound('We could not find that customer.');

    const [orders, wishlist, cart, reviews] = await Promise.all([
      ctx.db.query('SELECT * FROM orders WHERE user_id = $1 ORDER BY created_at DESC, id DESC', [id]).then((rows) => withItems(ctx.db, rows)),
      ctx.db.query('SELECT p.id, p.name, p.image_url FROM wishlist_items w JOIN products p ON p.id = w.product_id WHERE w.user_id = $1 ORDER BY w.created_at DESC', [id]),
      ctx.db.query(
        `SELECT p.name, p.image_url, v.size_ml, v.price_cents, ci.quantity FROM cart_items ci
         JOIN product_variants v ON v.id = ci.variant_id JOIN products p ON p.id = v.product_id WHERE ci.user_id = $1`,
        [id],
      ),
      ctx.db.query('SELECT r.rating, r.comment, r.created_at, p.name FROM reviews r JOIN products p ON p.id = r.product_id WHERE r.user_id = $1 ORDER BY r.created_at DESC', [id]),
    ]);

    res.json({
      user: toAdminUser(row),
      orders,
      wishlist: wishlist.map((w) => ({ id: w.id, name: w.name, imageUrl: w.image_url })),
      cart: cart.map((c) => ({ name: c.name, imageUrl: c.image_url, sizeMl: c.size_ml, priceCents: c.price_cents, quantity: c.quantity })),
      reviews: reviews.map((r) => ({ rating: r.rating, comment: r.comment, createdAt: r.created_at, product: r.name })),
    });
  });

  router.patch('/users/:id', async (req, res) => {
    const id = parse(schemas.id, req.params.id);
    const input = parse(userUpdateSchema, req.body);
    const me = currentUser(req);
    if (id === me.id && (input.role === 'customer' || input.isDisabled)) throw badRequest('You cannot remove your own admin access.');

    const [current] = await ctx.db.query('SELECT * FROM users WHERE id = $1', [id]);
    if (!current) throw notFound('We could not find that customer.');

    await ctx.db.query(
      `UPDATE users SET role = $2, is_disabled = $3, first_name = $4, last_name = $5, phone = $6, address = $7, updated_at = now() WHERE id = $1`,
      [
        id,
        input.role ?? current.role,
        input.isDisabled ?? current.is_disabled,
        input.firstName ?? current.first_name,
        input.lastName ?? current.last_name,
        input.phone ?? current.phone,
        input.address ?? current.address,
      ],
    );
    const [row] = await ctx.db.query(`${USER_STATS_SQL} WHERE u.id = $1`, [id]);
    res.json(toAdminUser(row!));
  });

  // Same as a customer deleting their own account: orders stay, without personal details
  router.delete('/users/:id', async (req, res) => {
    const id = parse(schemas.id, req.params.id);
    if (id === currentUser(req).id) throw badRequest('You cannot delete your own account here.');

    const deleted = await ctx.db.tx(async (q) => {
      await q.query(`UPDATE orders SET ship_name = 'Deleted account', ship_phone = '', ship_address = '' WHERE user_id = $1`, [id]);
      return q.query('DELETE FROM users WHERE id = $1 RETURNING id', [id]);
    });
    if (deleted.length === 0) throw notFound('We could not find that customer.');
    res.status(204).end();
  });

  // ---- Orders ---------------------------------------------------------------------------------
  router.get('/orders', async (req, res) => {
    const query = parse(ordersQuerySchema, req.query);
    const params: unknown[] = [];
    const where: string[] = [];
    const add = (value: unknown) => `$${params.push(value)}`;

    if (query.q) {
      const digits = query.q.replace(/\D/g, '');
      const pattern = add(likePattern(query.q));
      where.push(
        `(o.ship_name ILIKE ${pattern} OR o.ship_phone ILIKE ${pattern} OR u.email ILIKE ${pattern}${digits ? ` OR o.id = ${add(Number(digits.slice(-9)))}` : ''})`,
      );
    }
    if (query.userId) where.push(`o.user_id = ${add(query.userId)}`);
    // The status counts ignore the status filter, so the tabs always show every count
    const baseWhere = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const counts = await ctx.db.query(`SELECT o.status, count(*)::int AS count FROM orders o LEFT JOIN users u ON u.id = o.user_id ${baseWhere} GROUP BY o.status`, params);

    if (query.status) where.push(`o.status = ${add(query.status)}`);
    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const [{ total }] = (await ctx.db.query(`SELECT count(*)::int AS total FROM orders o LEFT JOIN users u ON u.id = o.user_id ${whereSql}`, params)) as [{ total: number }];
    const rows = await ctx.db.query(
      `SELECT o.*, u.email, u.first_name, u.last_name FROM orders o LEFT JOIN users u ON u.id = o.user_id ${whereSql}
       ORDER BY o.created_at DESC, o.id DESC LIMIT ${add(query.limit)} OFFSET ${add(query.offset)}`,
      params,
    );
    const orders = await withItems(ctx.db, rows);

    res.json({
      items: orders.map((order, i) => ({ ...order, customer: customerOf(rows[i]!) })),
      total,
      counts: Object.fromEntries(ORDER_STATUSES.map((status) => [status, counts.find((c) => c.status === status)?.count ?? 0])),
    });
  });

  router.get('/orders/:id', async (req, res) => {
    res.json(await adminOrder(ctx.db, parse(schemas.id, req.params.id)));
  });

  router.patch('/orders/:id', async (req, res) => {
    const id = parse(schemas.id, req.params.id);
    const { status } = parse(orderUpdateSchema, req.body);
    const rows = await ctx.db.query('UPDATE orders SET status = $2, updated_at = now() WHERE id = $1 RETURNING id', [id, status]);
    if (rows.length === 0) throw notFound('We could not find that order.');
    res.json(await adminOrder(ctx.db, id));
  });

  // ---- Products -------------------------------------------------------------------------------
  router.get('/products', async (_req, res) => {
    res.json(await adminProducts(ctx.db));
  });

  router.post('/products', async (req, res) => {
    const input = parse(productSchema, req.body);
    try {
      const id = await ctx.db.tx(async (q) => {
        const [row] = await q.query<{ id: number }>(
          `INSERT INTO products (slug, name, category, audience, description, scent_notes, image_url, is_best_seller, is_new_arrival, is_active)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING id`,
          productValues(input),
        );
        await saveVariants(q, row!.id, input.variants);
        return row!.id;
      });
      res.status(201).json((await adminProducts(ctx.db, id))[0]);
    } catch (error) {
      if (isUniqueViolation(error)) throw conflict('Another perfume already uses that web address (slug).');
      throw error;
    }
  });

  router.put('/products/:id', async (req, res) => {
    const id = parse(schemas.id, req.params.id);
    const input = parse(productSchema, req.body);
    try {
      const found = await ctx.db.tx(async (q) => {
        const rows = await q.query(
          `UPDATE products SET slug = $2, name = $3, category = $4, audience = $5, description = $6, scent_notes = $7,
             image_url = $8, is_best_seller = $9, is_new_arrival = $10, is_active = $11
           WHERE id = $1 RETURNING id`,
          [id, ...productValues(input)],
        );
        if (rows.length === 0) return false;
        await saveVariants(q, id, input.variants);
        return true;
      });
      if (!found) throw notFound('We could not find that perfume.');
      res.json((await adminProducts(ctx.db, id))[0]);
    } catch (error) {
      if (isUniqueViolation(error)) throw conflict('Another perfume already uses that web address (slug).');
      throw error;
    }
  });

  // Past orders keep their own copy of the name, price and picture, so deleting is safe for history
  router.delete('/products/:id', async (req, res) => {
    const rows = await ctx.db.query('DELETE FROM products WHERE id = $1 RETURNING id', [parse(schemas.id, req.params.id)]);
    if (rows.length === 0) throw notFound('We could not find that perfume.');
    res.status(204).end();
  });

  // ---- Contact messages -----------------------------------------------------------------------
  router.get('/messages', async (_req, res) => {
    const rows = await ctx.db.query('SELECT * FROM contact_messages ORDER BY created_at DESC LIMIT 200');
    res.json(rows.map((row) => ({ id: row.id, name: row.name, email: row.email, message: row.message, createdAt: row.created_at })));
  });

  router.delete('/messages/:id', async (req, res) => {
    await ctx.db.query('DELETE FROM contact_messages WHERE id = $1', [parse(schemas.id, req.params.id)]);
    res.status(204).end();
  });

  return router;
}

const customerOf = (row: Row) =>
  row.user_id ? { id: row.user_id, email: row.email, name: `${row.first_name} ${row.last_name}` } : null;

async function adminOrder(q: Queryable, id: number) {
  const rows = await q.query('SELECT o.*, u.email, u.first_name, u.last_name FROM orders o LEFT JOIN users u ON u.id = o.user_id WHERE o.id = $1', [id]);
  if (rows.length === 0) throw notFound(`We could not find order ${orderNumber(id)}.`);
  const [order] = await withItems(q, rows);
  return { ...order!, customer: customerOf(rows[0]!), updatedAt: rows[0]!.updated_at };
}
