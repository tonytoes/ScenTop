import { z } from 'zod';
import type { Queryable, Row } from '../db';
import type { CartDto, CartItemDto } from '../lib/dto';

/** Flat shipping fee in centavos (PHP 50.00). */
export const SHIPPING_FEE_CENTS = 5000;
export const MAX_QUANTITY = 99;

export const quantitySchema = z.coerce
  .number({ error: 'Quantity must be a number.' })
  .int()
  .min(1, 'Quantity must be at least 1.')
  .max(MAX_QUANTITY, `You can order up to ${MAX_QUANTITY} of one item.`);

export const lineSchema = z.object({
  variantId: z.coerce.number().int().positive(),
  quantity: quantitySchema,
});
export type CartLine = z.infer<typeof lineSchema>;

const LINE_SQL = `
  SELECT v.id AS variant_id, v.size_ml, v.price_cents, p.id AS product_id, p.slug, p.name, p.image_url`;

function toItem(row: Row, quantity: number): CartItemDto {
  return {
    variantId: row.variant_id,
    productId: row.product_id,
    slug: row.slug,
    name: row.name,
    imageUrl: row.image_url,
    sizeMl: row.size_ml,
    unitPriceCents: row.price_cents,
    quantity,
    lineTotalCents: row.price_cents * quantity,
  };
}

/** Totals are always computed here from database prices, never from anything the browser sends. */
export function buildCart(items: CartItemDto[]): CartDto {
  const subtotalCents = items.reduce((sum, item) => sum + item.lineTotalCents, 0);
  const shippingFeeCents = items.length > 0 ? SHIPPING_FEE_CENTS : 0;
  return {
    items,
    itemCount: items.reduce((sum, item) => sum + item.quantity, 0),
    subtotalCents,
    shippingFeeCents,
    totalCents: subtotalCents + shippingFeeCents,
  };
}

export async function getCart(q: Queryable, userId: number): Promise<CartDto> {
  const rows = await q.query(
    `${LINE_SQL}, ci.quantity
     FROM cart_items ci
     JOIN product_variants v ON v.id = ci.variant_id
     JOIN products p ON p.id = v.product_id
     WHERE ci.user_id = $1
     ORDER BY ci.created_at, ci.variant_id`,
    [userId],
  );
  return buildCart(rows.map((row) => toItem(row, row.quantity)));
}

/** Prices a list of {variantId, quantity} lines. Used for guests, whose cart lives on their device. */
export async function previewCart(q: Queryable, lines: CartLine[]): Promise<CartDto> {
  const quantities = new Map<number, number>();
  for (const line of lines) {
    quantities.set(line.variantId, Math.min(MAX_QUANTITY, (quantities.get(line.variantId) ?? 0) + line.quantity));
  }
  if (quantities.size === 0) return buildCart([]);

  const rows = await q.query(
    `${LINE_SQL}
     FROM product_variants v
     JOIN products p ON p.id = v.product_id
     WHERE v.id = ANY($1::int[])`,
    [[...quantities.keys()]],
  );
  const byVariant = new Map(rows.map((row) => [row.variant_id as number, row]));

  // Keep the order the guest added things in; silently drop variants that no longer exist
  const items = [...quantities]
    .filter(([variantId]) => byVariant.has(variantId))
    .map(([variantId, quantity]) => toItem(byVariant.get(variantId)!, quantity));
  return buildCart(items);
}

/** Adds `quantity` to a cart line, creating it if needed. Quantities never go above MAX_QUANTITY. */
export async function addToCart(q: Queryable, userId: number, variantId: number, quantity: number): Promise<boolean> {
  const rows = await q.query(
    `INSERT INTO cart_items (user_id, variant_id, quantity)
     SELECT $1::int, v.id, $3::int FROM product_variants v WHERE v.id = $2::int
     ON CONFLICT (user_id, variant_id)
       DO UPDATE SET quantity = LEAST(${MAX_QUANTITY}, cart_items.quantity + EXCLUDED.quantity)
     RETURNING variant_id`,
    [userId, variantId, quantity],
  );
  return rows.length > 0; // false when the variant does not exist
}
