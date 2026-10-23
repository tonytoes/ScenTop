import type { Db } from '../db';
import { orderNumber } from '../lib/dto';
import { categories } from './catalogue';
import { ORDER_STATUSES } from './orders';

// Days, weeks and hours are counted in the shop's own time zone, not the server's.
const TZ = 'Asia/Manila';
const LOCAL = (column: string) => `(${column} AT TIME ZONE '${TZ}')`;
const DAY = (column: string) => `${LOCAL(column)}::date`;
// Cancelled orders never count as sales
const SOLD = "o.status <> 'cancelled'";

export const ANALYTICS_RANGES = [7, 30, 90, 365] as const;

interface Metric {
  value: number;
  previous: number;
}

/** Everything the admin dashboard shows, for the last `days` days compared with the `days` before that. */
export async function dashboard(db: Db, days: number) {
  const [range] = await db.query<{ today: string; start: string; prev_start: string }>(
    `SELECT ${DAY('now()')}::text AS today,
       (${DAY('now()')} - ($1::int - 1))::text AS start,
       (${DAY('now()')} - (2 * $1::int - 1))::text AS prev_start`,
    [days],
  );
  const { today, start, prev_start: prevStart } = range!;
  // $1 = first day of the previous period, $2 = first day of this period, $3 = today
  const bounds = [prevStart, start, today];
  // Queries about this period only take $1 = first day, $2 = today
  const period = [start, today];
  const inPeriod = `${DAY('o.created_at')} BETWEEN $1::date AND $2::date`;

  const [series, totals, statuses, categoryRows, sizeRows, audienceRows, heat, top, customerMix, topCustomers, month, carts, wished, recent, lifetime] =
    await Promise.all([
      // Revenue and orders per day for both periods
      db.query(
        `SELECT d::date::text AS day,
           COALESCE(sum(o.total_cents) FILTER (WHERE ${SOLD}), 0)::int AS revenue,
           count(o.id) FILTER (WHERE ${SOLD})::int AS orders
         FROM generate_series($1::date, $2::date, interval '1 day') AS d
         LEFT JOIN orders o ON ${DAY('o.created_at')} = d::date
         GROUP BY d ORDER BY d`,
        [prevStart, today],
      ),
      // Headline numbers for each period
      db.query(
        `SELECT (${DAY('o.created_at')} >= $2::date) AS current,
           COALESCE(sum(o.total_cents) FILTER (WHERE ${SOLD}), 0)::int AS revenue,
           count(*) FILTER (WHERE ${SOLD})::int AS orders,
           count(*) FILTER (WHERE o.status = 'cancelled')::int AS cancelled,
           count(*)::int AS placed,
           count(DISTINCT o.user_id) FILTER (WHERE ${SOLD})::int AS buyers
         FROM orders o WHERE ${DAY('o.created_at')} BETWEEN $1::date AND $3::date
         GROUP BY 1`,
        bounds,
      ),
      db.query(`SELECT o.status, count(*)::int AS count FROM orders o WHERE ${inPeriod} GROUP BY o.status`, period),
      // What sold: by category, bottle size and audience
       db.query(
        `SELECT p.category AS name, sum(oi.quantity)::int AS units, sum(oi.quantity * oi.unit_price_cents)::int AS revenue
         FROM order_items oi JOIN orders o ON o.id = oi.order_id JOIN products p ON p.id = oi.product_id
         WHERE ${SOLD} AND ${inPeriod} GROUP BY p.category`,
        period,
      ),
      db.query(
        `SELECT oi.size_ml, sum(oi.quantity)::int AS units, sum(oi.quantity * oi.unit_price_cents)::int AS revenue
         FROM order_items oi JOIN orders o ON o.id = oi.order_id
         WHERE ${SOLD} AND ${inPeriod} GROUP BY oi.size_ml ORDER BY oi.size_ml`,
        period,
      ),
      db.query(
        `SELECT p.audience AS name, sum(oi.quantity)::int AS units
         FROM order_items oi JOIN orders o ON o.id = oi.order_id JOIN products p ON p.id = oi.product_id
         WHERE ${SOLD} AND ${inPeriod} GROUP BY p.audience`,
        period,
      ),
      // When people shop: weekday (0 = Sunday) x hour
      db.query(
        `SELECT extract(dow FROM ${LOCAL('o.created_at')})::int AS dow, extract(hour FROM ${LOCAL('o.created_at')})::int AS hour, count(*)::int AS orders
         FROM orders o WHERE ${SOLD} AND ${inPeriod} GROUP BY 1, 2`,
        period,
      ),
      db.query(
        `SELECT oi.product_id, sum(oi.quantity)::int AS units, sum(oi.quantity * oi.unit_price_cents)::int AS revenue
         FROM order_items oi JOIN orders o ON o.id = oi.order_id
         WHERE ${SOLD} AND ${inPeriod} AND oi.product_id IS NOT NULL
         GROUP BY oi.product_id ORDER BY revenue DESC LIMIT 6`,
        period,
      ),
      // First orders vs repeat orders, per week
      db.query(
        `WITH ranked AS (
           SELECT o.created_at, o.status, row_number() OVER (PARTITION BY o.user_id ORDER BY o.created_at) AS nth
           FROM orders o WHERE ${SOLD} AND o.user_id IS NOT NULL
         )
         SELECT date_trunc('week', ${LOCAL('o.created_at')})::date::text AS week,
           count(*) FILTER (WHERE nth = 1)::int AS first,
           count(*) FILTER (WHERE nth > 1)::int AS repeat
         FROM ranked o WHERE ${inPeriod} GROUP BY 1 ORDER BY 1`,
        period,
      ),
      db.query(
        `SELECT u.id, u.first_name, u.last_name, u.email, u.photo_url, count(o.id)::int AS orders, sum(o.total_cents)::int AS spent
         FROM orders o JOIN users u ON u.id = o.user_id
         WHERE ${SOLD} AND ${inPeriod} GROUP BY u.id ORDER BY spent DESC LIMIT 5`,
        period,
      ),
      // Month to date against the whole of last month
      db.query(
        `SELECT
           COALESCE(sum(o.total_cents) FILTER (WHERE date_trunc('month', ${LOCAL('o.created_at')}) = date_trunc('month', ${LOCAL('now()')})), 0)::int AS this_month,
           COALESCE(sum(o.total_cents) FILTER (WHERE date_trunc('month', ${LOCAL('o.created_at')}) = date_trunc('month', ${LOCAL('now()')}) - interval '1 month'), 0)::int AS last_month,
           extract(day FROM ${LOCAL('now()')})::int AS day_of_month,
           extract(day FROM date_trunc('month', ${LOCAL('now()')}) + interval '1 month - 1 day')::int AS days_in_month
         FROM orders o WHERE ${SOLD}`,
      ),
      // Money waiting in carts that has not been checked out
      db.query(
        `SELECT count(DISTINCT ci.user_id)::int AS shoppers, COALESCE(sum(ci.quantity * v.price_cents), 0)::int AS value, COALESCE(sum(ci.quantity), 0)::int AS items
         FROM cart_items ci JOIN product_variants v ON v.id = ci.variant_id`,
      ),
      db.query(
        `SELECT p.id, p.name, p.image_url, count(*)::int AS saves
         FROM wishlist_items w JOIN products p ON p.id = w.product_id GROUP BY p.id ORDER BY saves DESC, p.name LIMIT 5`,
      ),
      db.query(
        `SELECT o.id, o.status, o.total_cents, o.ship_name, o.created_at,
           (SELECT sum(quantity)::int FROM order_items WHERE order_id = o.id) AS items
         FROM orders o ORDER BY o.created_at DESC, o.id DESC LIMIT 8`,
      ),
      db.query(
        `SELECT
           (SELECT count(*)::int FROM users WHERE role = 'customer') AS customers,
           (SELECT count(*)::int FROM users WHERE role = 'customer' AND ${DAY('created_at')} BETWEEN $2::date AND $3::date) AS new_customers,
           (SELECT count(*)::int FROM users WHERE role = 'customer' AND ${DAY('created_at')} BETWEEN $1::date AND $2::date - 1) AS prev_new_customers,
           (SELECT count(*)::int FROM products WHERE is_active) AS products,
           (SELECT count(*)::int FROM orders WHERE status = 'pending') AS to_confirm,
           (SELECT count(*)::int FROM orders WHERE status = 'confirmed') AS to_ship,
           (SELECT COALESCE(avg(rating), 0)::float8 FROM reviews) AS rating,
           (SELECT count(*)::int FROM reviews) AS reviews,
           (SELECT count(*)::int FROM contact_messages WHERE created_at > now() - interval '7 days') AS messages,
           (SELECT count(*)::int FROM (SELECT user_id FROM orders WHERE status <> 'cancelled' AND user_id IS NOT NULL GROUP BY user_id HAVING count(*) > 1) r) AS repeat_buyers,
           (SELECT count(DISTINCT user_id)::int FROM orders WHERE status <> 'cancelled') AS buyers`,
        bounds,
      ),
    ]);

  const periodTotals = (current: boolean) => totals.find((row) => row.current === current) ?? { revenue: 0, orders: 0, cancelled: 0, placed: 0, buyers: 0 };
  const now = periodTotals(true);
  const before = periodTotals(false);
  const metric = (pick: (row: typeof now) => number): Metric => ({ value: pick(now), previous: pick(before) });
  const aov = (row: typeof now) => (row.orders ? Math.round(row.revenue / row.orders) : 0);
  const cancelRate = (row: typeof now) => (row.placed ? row.cancelled / row.placed : 0);

  const topProducts = top.length
    ? await db.query('SELECT id, name, slug, image_url, category FROM products WHERE id = ANY($1::int[])', [top.map((row) => row.product_id)])
    : [];
  const stats = lifetime[0]!;
  const m = month[0]!;

  return {
    range: { days, from: start, to: today },
    kpis: {
      revenue: metric((row) => row.revenue),
      orders: metric((row) => row.orders),
      averageOrder: metric(aov),
      newCustomers: { value: stats.new_customers, previous: stats.prev_new_customers },
      cancelRate: metric(cancelRate),
      buyers: metric((row) => row.buyers),
    },
    // Daily values for this period, and the matching day of the previous period
    daily: series.slice(days).map((row, i) => ({
      date: row.day,
      revenue: row.revenue,
      orders: row.orders,
      previousRevenue: series[i]?.revenue ?? 0,
    })),
    statuses: ORDER_STATUSES.map((status) => ({ status, count: statuses.find((row) => row.status === status)?.count ?? 0 })),
    categories: categories.map((name) => {
      const row = categoryRows.find((r) => r.name === name);
      return { name, units: row?.units ?? 0, revenue: row?.revenue ?? 0 };
    }),
    sizes: sizeRows.map((row) => ({ sizeMl: row.size_ml, units: row.units, revenue: row.revenue })),
    audience: ['women', 'men', 'unisex'].map((name) => ({ name, units: audienceRows.find((row) => row.name === name)?.units ?? 0 })),
    heatmap: heat.map((row) => ({ day: row.dow, hour: row.hour, orders: row.orders })),
    topProducts: top.map((row) => {
      const product = topProducts.find((p) => p.id === row.product_id)!;
      return { id: row.product_id, name: product.name, slug: product.slug, imageUrl: product.image_url, category: product.category, units: row.units, revenue: row.revenue };
    }),
    customerMix: customerMix.map((row) => ({ week: row.week, first: row.first, repeat: row.repeat })),
    topCustomers: topCustomers.map((row) => ({
      id: row.id,
      name: `${row.first_name} ${row.last_name}`,
      email: row.email,
      photoUrl: row.photo_url,
      orders: row.orders,
      spentCents: row.spent,
    })),
    month: { revenue: m.this_month, lastMonthRevenue: m.last_month, dayOfMonth: m.day_of_month, daysInMonth: m.days_in_month },
    carts: { shoppers: carts[0]!.shoppers, items: carts[0]!.items, valueCents: carts[0]!.value },
    mostWished: wished.map((row) => ({ id: row.id, name: row.name, imageUrl: row.image_url, saves: row.saves })),
    recentOrders: recent.map((row) => ({
      id: row.id,
      orderNumber: orderNumber(row.id),
      status: row.status,
      totalCents: row.total_cents,
      customer: row.ship_name,
      items: row.items ?? 0,
      createdAt: row.created_at,
    })),
    totals: {
      customers: stats.customers,
      products: stats.products,
      toConfirm: stats.to_confirm,
      toShip: stats.to_ship,
      rating: Math.round(stats.rating * 10) / 10,
      reviews: stats.reviews,
      newMessages: stats.messages,
      repeatRate: stats.buyers ? stats.repeat_buyers / stats.buyers : 0,
    },
  };
}
