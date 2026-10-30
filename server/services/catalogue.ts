import { z } from 'zod';
import type { Db, Queryable, Row } from '../db';
import { toProductSummary, type ProductDetailDto, type ProductSummaryDto, type VariantDto } from '../lib/dto';
import { notFound } from '../lib/errors';

export const categories = ['Floral', 'Refreshing', 'Gourmand', 'Signature', 'Verdant'] as const;

const SORTS = {
  featured: 'p.is_best_seller DESC, p.id',
  newest: 'p.is_new_arrival DESC, p.id DESC',
  'price-asc': 'from_price_cents ASC, p.id',
  'price-desc': 'from_price_cents DESC, p.id',
  name: 'p.name ASC',
  rating: 'rating_avg DESC, rating_count DESC, p.id',
} as const;

export const listQuerySchema = z.object({
  q: z.string().trim().max(80).optional(),
  category: z.enum(categories).optional(),
  audience: z.enum(['women', 'men']).optional(),
  collection: z.enum(['best', 'new']).optional(),
  sort: z.enum(Object.keys(SORTS) as [keyof typeof SORTS, ...(keyof typeof SORTS)[]]).default('featured'),
  ids: z
    .string()
    .regex(/^\d+(,\d+)*$/)
    .transform((value) => value.split(',').map(Number).slice(0, 100))
    .optional(),
  limit: z.coerce.number().int().min(1).max(100).default(12),
  offset: z.coerce.number().int().min(0).default(0),
});
export type ListQuery = z.infer<typeof listQuerySchema>;

const SUMMARY_SQL = `
  SELECT p.*,
    (SELECT min(price_cents) FROM product_variants v WHERE v.product_id = p.id)::int AS from_price_cents,
    COALESCE((SELECT avg(rating) FROM reviews r WHERE r.product_id = p.id), 0)::float8 AS rating_avg,
    (SELECT count(*) FROM reviews r WHERE r.product_id = p.id)::int AS rating_count
  FROM products p`;

async function variantsFor(q: Queryable, productIds: number[]): Promise<Map<number, VariantDto[]>> {
  const map = new Map<number, VariantDto[]>();
  if (productIds.length === 0) return map;

  const rows = await q.query(
    'SELECT id, product_id, size_ml, price_cents FROM product_variants WHERE product_id = ANY($1::int[]) ORDER BY size_ml',
    [productIds],
  );
  for (const row of rows) {
    const list = map.get(row.product_id) ?? [];
    list.push({ id: row.id, sizeMl: row.size_ml, priceCents: row.price_cents });
    map.set(row.product_id, list);
  }
  return map;
}

export async function summarise(q: Queryable, rows: Row[]): Promise<ProductSummaryDto[]> {
  const variants = await variantsFor(q, rows.map((row) => row.id));
  return rows.map((row) => toProductSummary(row, variants.get(row.id) ?? []));
}

export async function listProducts(db: Db, query: ListQuery): Promise<{ items: ProductSummaryDto[]; total: number }> {
  const params: unknown[] = [];
  // Perfumes hidden from the admin side never show in the shop
  const where: string[] = ['p.is_active'];
  const add = (value: unknown) => `$${params.push(value)}`;

  if (query.q) {
    const pattern = add(`%${query.q.replace(/[\\%_]/g, '\\$&')}%`);
    where.push(
      `(p.name ILIKE ${pattern} OR p.description ILIKE ${pattern} OR p.category ILIKE ${pattern}
        OR EXISTS (SELECT 1 FROM unnest(p.scent_notes) AS note WHERE note ILIKE ${pattern}))`,
    );
  }
  if (query.category) where.push(`p.category = ${add(query.category)}`);
  // "For men" also includes unisex perfumes
  if (query.audience) where.push(`p.audience IN (${add(query.audience)}, 'unisex')`);
  if (query.collection === 'best') where.push('p.is_best_seller');
  if (query.collection === 'new') where.push('p.is_new_arrival');
  if (query.ids) where.push(`p.id = ANY(${add(query.ids)}::int[])`);

  const whereSql = `WHERE ${where.join(' AND ')}`;

  const [{ total }] = (await db.query<{ total: number }>(
    `SELECT count(*)::int AS total FROM products p ${whereSql}`,
    params,
  )) as [{ total: number }];

  const limit = add(query.limit);
  const offset = add(query.offset);
  const rows = await db.query(
    `${SUMMARY_SQL} ${whereSql} ORDER BY ${SORTS[query.sort]} LIMIT ${limit} OFFSET ${offset}`,
    params,
  );

  return { items: await summarise(db, rows), total };
}

export async function getProduct(db: Db, idOrSlug: string): Promise<ProductDetailDto> {
  const byId = /^\d+$/.test(idOrSlug);
  const [row] = await db.query(`${SUMMARY_SQL} WHERE ${byId ? 'p.id' : 'p.slug'} = $1 AND p.is_active`, [byId ? Number(idOrSlug) : idOrSlug]);
  if (!row) throw notFound('We could not find that perfume.');

  const [summary] = await summarise(db, [row]);
  return { ...summary!, description: row.description, scentNotes: row.scent_notes };
}

export async function categoryCounts(db: Db): Promise<{ name: string; count: number }[]> {
  const rows = await db.query<{ category: string; count: number }>(
    'SELECT category, count(*)::int AS count FROM products WHERE is_active GROUP BY category',
  );
  const counts = new Map(rows.map((row) => [row.category, row.count]));
  return categories.map((name) => ({ name, count: counts.get(name) ?? 0 }));
}

export async function wishlistProducts(q: Queryable, userId: number): Promise<ProductSummaryDto[]> {
  const rows = await q.query(
    `${SUMMARY_SQL} JOIN wishlist_items w ON w.product_id = p.id WHERE w.user_id = $1 AND p.is_active ORDER BY w.created_at DESC`,
    [userId],
  );
  return summarise(q, rows);
}
