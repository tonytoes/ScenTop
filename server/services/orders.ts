import type { Queryable, Row } from '../db';
import { orderNumber, type OrderDto } from '../lib/dto';

export const ORDER_STATUSES = ['pending', 'confirmed', 'shipped', 'delivered', 'cancelled'] as const;

/** Turns order rows into OrderDtos, loading their items in one query. */
export async function withItems(q: Queryable, orders: Row[]): Promise<OrderDto[]> {
  if (orders.length === 0) return [];

  const items = await q.query('SELECT * FROM order_items WHERE order_id = ANY($1::int[]) ORDER BY id', [orders.map((o) => o.id)]);

  return orders.map((order) => {
    const lines = items.filter((item) => item.order_id === order.id);
    return {
      id: order.id,
      orderNumber: orderNumber(order.id),
      status: order.status,
      paymentMethod: order.payment_method,
      subtotalCents: order.subtotal_cents,
      shippingFeeCents: order.shipping_fee_cents,
      totalCents: order.total_cents,
      shipName: order.ship_name,
      shipPhone: order.ship_phone,
      shipAddress: order.ship_address,
      notes: order.notes,
      createdAt: order.created_at,
      itemCount: lines.reduce((sum, line) => sum + line.quantity, 0),
      items: lines.map((line) => ({
        productId: line.product_id,
        slug: line.product_slug,
        name: line.name,
        imageUrl: line.image_url,
        sizeMl: line.size_ml,
        unitPriceCents: line.unit_price_cents,
        quantity: line.quantity,
      })),
    };
  });
}
