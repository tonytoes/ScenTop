import type { Db } from './index';
import { seedProducts } from './seed-data';

/** 100 ml costs 1.75x the 50 ml bottle, rounded to the nearest 50 pesos. */
export function price100(price50: number): number {
  return Math.round((price50 * 1.75) / 50) * 50;
}

/** Inserts or updates the catalogue. Safe to run again and again. */
export async function seedCatalogue(db: Db): Promise<number> {
  await db.tx(async (q) => {
    for (const product of seedProducts) {
      const [row] = await q.query<{ id: number }>(
        `INSERT INTO products (slug, name, category, audience, description, scent_notes, image_url, is_best_seller, is_new_arrival)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         ON CONFLICT (slug) DO UPDATE SET
           name = EXCLUDED.name,
           category = EXCLUDED.category,
           audience = EXCLUDED.audience,
           description = EXCLUDED.description,
           scent_notes = EXCLUDED.scent_notes,
           image_url = EXCLUDED.image_url,
           is_best_seller = EXCLUDED.is_best_seller,
           is_new_arrival = EXCLUDED.is_new_arrival
         RETURNING id`,
        [
          product.slug,
          product.name,
          product.category,
          product.audience,
          product.description,
          product.scentNotes,
          `assets/products/${product.slug}.webp`,
          product.bestSeller ?? false,
          product.newArrival ?? false,
        ],
      );

      const variants = [
        { sizeMl: 50, priceCents: product.price50 * 100 },
        { sizeMl: 100, priceCents: price100(product.price50) * 100 },
      ];
      for (const variant of variants) {
        await q.query(
          `INSERT INTO product_variants (product_id, size_ml, price_cents)
           VALUES ($1, $2, $3)
           ON CONFLICT (product_id, size_ml) DO UPDATE SET price_cents = EXCLUDED.price_cents`,
          [row!.id, variant.sizeMl, variant.priceCents],
        );
      }
    }
  });
  return seedProducts.length;
}

/** Used on first start: fills an empty database, never touches an existing catalogue. */
export async function seedIfEmpty(db: Db): Promise<boolean> {
  const [row] = await db.query<{ count: number }>('SELECT count(*)::int AS count FROM products');
  if (row!.count > 0) return false;
  await seedCatalogue(db);
  return true;
}
