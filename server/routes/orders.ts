import { Router } from 'express';
import { z } from 'zod';
import type { AppContext } from '../context';
import type { Queryable } from '../db';
import type { OrderDto } from '../lib/dto';
import { badRequest, notFound } from '../lib/errors';
import { parse, schemas } from '../lib/validate';
import { currentUser, requireAuth } from '../middleware/auth';
import { getCart } from '../services/cart';
import { withItems } from '../services/orders';

const checkoutSchema = z.object({
  shipName: schemas.name('Full name'),
  shipPhone: schemas.phone,
  shipAddress: schemas
    .required('Delivery address')
    .min(10, 'Please enter your full delivery address.')
    .max(300, 'Address is too long.'),
  paymentMethod: z.literal('cod', { error: 'Choose a payment method.' }),
  notes: z.string().trim().max(300, 'Notes are too long.').default(''),
});

async function loadOrders(q: Queryable, userId: number, orderId?: number): Promise<OrderDto[]> {
  const orders = await q.query(
    `SELECT * FROM orders WHERE user_id = $1 ${orderId ? 'AND id = $2' : ''} ORDER BY created_at DESC, id DESC LIMIT 50`,
    orderId ? [userId, orderId] : [userId],
  );
  return withItems(q, orders);
}

export function ordersRouter(ctx: AppContext): Router {
  const router = Router();
  router.use('/orders', requireAuth(ctx));

  router.get('/orders', async (req, res) => {
    res.json(await loadOrders(ctx.db, currentUser(req).id));
  });

  router.get('/orders/:id', async (req, res) => {
    const [order] = await loadOrders(ctx.db, currentUser(req).id, parse(schemas.id, req.params.id));
    if (!order) throw notFound('We could not find that order.');
    res.json(order);
  });

  // Turns the logged-in user's saved cart into an order, using the prices in the database
  router.post('/orders', async (req, res) => {
    const input = parse(checkoutSchema, req.body);
    const userId = currentUser(req).id;

    const orderId = await ctx.db.tx(async (q) => {
      const cart = await getCart(q, userId);
      if (cart.items.length === 0) throw badRequest('Your cart is empty.');

      const [order] = await q.query<{ id: number }>(
        `INSERT INTO orders (user_id, payment_method, subtotal_cents, shipping_fee_cents, total_cents, ship_name, ship_phone, ship_address, notes)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id`,
        [userId, input.paymentMethod, cart.subtotalCents, cart.shippingFeeCents, cart.totalCents, input.shipName, input.shipPhone, input.shipAddress, input.notes],
      );

      for (const item of cart.items) {
        await q.query(
          `INSERT INTO order_items (order_id, product_id, product_slug, name, size_ml, unit_price_cents, quantity, image_url)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [order!.id, item.productId, item.slug, item.name, item.sizeMl, item.unitPriceCents, item.quantity, item.imageUrl],
        );
      }
      await q.query('DELETE FROM cart_items WHERE user_id = $1', [userId]);
      return order!.id;
    });

    const [created] = await loadOrders(ctx.db, userId, orderId);
    res.status(201).json(created);
  });

  // Customers can cancel until the shop has confirmed the order
  router.post('/orders/:id/cancel', async (req, res) => {
    const userId = currentUser(req).id;
    const orderId = parse(schemas.id, req.params.id);

    const rows = await ctx.db.query(
      `UPDATE orders SET status = 'cancelled', updated_at = now()
       WHERE id = $1 AND user_id = $2 AND status = 'pending' RETURNING id`,
      [orderId, userId],
    );
    if (rows.length === 0) {
      const [existing] = await loadOrders(ctx.db, userId, orderId);
      if (!existing) throw notFound('We could not find that order.');
      throw badRequest('This order can no longer be cancelled.');
    }
    const [updated] = await loadOrders(ctx.db, userId, orderId);
    res.json(updated);
  });

  return router;
}
