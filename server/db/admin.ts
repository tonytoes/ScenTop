import type { Config } from '../config';
import { hashPassword } from '../lib/security';
import type { Db, Queryable } from './index';

/** Creates the first admin from the config when the shop has none. Returns the e-mail it created, if any. */
export async function ensureAdmin(db: Db, config: Config): Promise<string | null> {
  if (!config.bootstrapAdmin) return null;
  const [existing] = await db.query("SELECT 1 FROM users WHERE role = 'admin' LIMIT 1");
  if (existing) return null;

  const { email, password } = config.bootstrapAdmin;
  const passwordHash = await hashPassword(password, config.bcryptRounds);
  await db.query(
    `INSERT INTO users (email, password_hash, first_name, last_name, role)
     VALUES ($1, $2, 'Shop', 'Admin', 'admin')
     ON CONFLICT (lower(email)) DO UPDATE SET role = 'admin', is_disabled = false`,
    [email, passwordHash],
  );
  return email;
}

/** Creates an admin account, or resets the password and gives admin rights when the e-mail already has an account. */
export async function createAdmin(db: Db, config: Config, email: string, password: string, name = 'Shop Admin'): Promise<'created' | 'updated'> {
  const [first = 'Shop', ...rest] = name.trim().split(/\s+/);
  const passwordHash = await hashPassword(password, config.bcryptRounds);
  const existing = await db.query('SELECT 1 FROM users WHERE lower(email) = lower($1)', [email]);
  await db.query(
    `INSERT INTO users (email, password_hash, first_name, last_name, role)
     VALUES ($1, $2, $3, $4, 'admin')
     ON CONFLICT (lower(email)) DO UPDATE SET password_hash = $2, role = 'admin', is_disabled = false`,
    [email, passwordHash, first, rest.join(' ') || 'Admin'],
  );
  return existing.length ? 'updated' : 'created';
}

/** Gives an existing account admin rights. Returns false when no account has that e-mail. */
export async function makeAdmin(db: Db, email: string): Promise<boolean> {
  const rows = await db.query("UPDATE users SET role = 'admin', is_disabled = false WHERE lower(email) = lower($1) RETURNING id", [email]);
  return rows.length > 0;
}

// ---------------------------------------------------------------------------------------------
// Demo data: fake customers and six months of orders, so the admin dashboard has something to show.
// Every demo account uses this domain, which is how they are found again and replaced.
export const DEMO_DOMAIN = 'demo.scentop.local';

const FIRST = ['Maria', 'Jose', 'Andrea', 'Paolo', 'Bea', 'Miguel', 'Camille', 'Carlo', 'Isabel', 'Rafael', 'Trisha', 'Enzo', 'Lea', 'Gabriel', 'Nicole', 'Marco', 'Sofia', 'Luis', 'Angela', 'Kevin', 'Pia', 'Ramon', 'Hannah', 'Daniel'];
const LAST = ['Santos', 'Reyes', 'Cruz', 'Bautista', 'Garcia', 'Mendoza', 'Torres', 'Flores', 'Villanueva', 'Ramos', 'Aquino', 'Castillo', 'Navarro', 'Domingo', 'Lim', 'Tan'];
const CITIES = ['Quezon City', 'Makati', 'Pasig', 'Taguig', 'Cebu City', 'Davao City', 'Iloilo City', 'Baguio', 'Cagayan de Oro', 'Antipolo'];
// Relative chance of an order in each hour of the day (lunch break and evening peaks)
const HOUR_WEIGHTS = [1, 0.5, 0.3, 0.2, 0.2, 0.4, 1, 2, 3, 4, 4, 5, 8, 7, 5, 4, 4, 5, 6, 8, 10, 11, 8, 3];
// Sunday..Saturday
const DAY_WEIGHTS = [1.3, 0.8, 0.85, 0.9, 1, 1.35, 1.5];

/** Small seeded random generator, so the demo looks the same every time. */
function random(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function weighted<T>(rand: () => number, items: T[], weights: number[]): T {
  const total = weights.reduce((a, b) => a + b, 0);
  let roll = rand() * total;
  for (let i = 0; i < items.length; i++) {
    roll -= weights[i]!;
    if (roll <= 0) return items[i]!;
  }
  return items[items.length - 1]!;
}

async function removeDemo(q: Queryable) {
  const pattern = `%@${DEMO_DOMAIN}`;
  await q.query('DELETE FROM orders WHERE user_id IN (SELECT id FROM users WHERE email LIKE $1)', [pattern]);
  await q.query('DELETE FROM users WHERE email LIKE $1', [pattern]);
}

/** Replaces the demo customers and their orders. Real accounts and orders are never touched. */
export async function seedDemo(db: Db, days = 180): Promise<{ customers: number; orders: number }> {
  const rand = random(20_24);
  const variants = await db.query(
    `SELECT v.id, v.size_ml, v.price_cents, p.id AS product_id, p.slug, p.name, p.image_url, p.is_best_seller
     FROM product_variants v JOIN products p ON p.id = v.product_id ORDER BY v.id`,
  );
  if (variants.length === 0) throw new Error('Add the perfumes first (npm run db:seed).');

  const passwordHash = await hashPassword('demo-customer-1', 4);
  const now = Date.now();
  const DAY = 86_400_000;

  return db.tx(async (q) => {
    await removeDemo(q);

    // Customers join over time, a little faster recently
    const customers: { id: number; joined: number; name: string; phone: string; address: string; loyalty: number }[] = [];
    const customerCount = 85;
    for (let i = 0; i < customerCount; i++) {
      const first = FIRST[Math.floor(rand() * FIRST.length)]!;
      const last = LAST[Math.floor(rand() * LAST.length)]!;
      const joined = now - rand() * (days + 20) * DAY;
      const phone = `09${Math.floor(100_000_000 + rand() * 899_999_999)}`;
      const address = `${Math.floor(1 + rand() * 300)} ${LAST[Math.floor(rand() * LAST.length)]} St., ${CITIES[Math.floor(rand() * CITIES.length)]}`;
      const [row] = await q.query<{ id: number }>(
        `INSERT INTO users (email, password_hash, first_name, last_name, phone, address, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $7) RETURNING id`,
        [`${first}.${last}.${i}@${DEMO_DOMAIN}`.toLowerCase(), passwordHash, first, last, phone, address, new Date(joined)],
      );
      // A few loyal customers order again and again
      customers.push({ id: row!.id, joined, name: `${first} ${last}`, phone, address, loyalty: rand() < 0.2 ? 6 : rand() < 0.5 ? 2 : 1 });
    }

    let orderCount = 0;
    for (let day = days; day >= 0; day--) {
      const date = new Date(now - day * DAY);
      // Sales grow over the period, with a bump around payday (15th and 30th)
      const growth = 0.9 + (1 - day / days) * 2.4;
      const payday = [14, 15, 29, 30, 1].includes(date.getDate()) ? 1.6 : 1;
      const expected = growth * payday * DAY_WEIGHTS[date.getDay()]!;
      const count = Math.floor(expected + rand() * expected * 0.8);

      for (let n = 0; n < count; n++) {
        const hour = weighted(rand, HOUR_WEIGHTS.map((_, h) => h), HOUR_WEIGHTS);
        const createdAt = new Date(date);
        createdAt.setHours(hour, Math.floor(rand() * 60), Math.floor(rand() * 60), 0);
        if (createdAt.getTime() > now) continue;

        const eligible = customers.filter((c) => c.joined <= createdAt.getTime());
        if (eligible.length === 0) continue;
        const customer = weighted(rand, eligible, eligible.map((c) => c.loyalty));

        const lineCount = weighted(rand, [1, 2, 3], [6, 3, 1]);
        const lines = new Map<number, { variant: (typeof variants)[number]; quantity: number }>();
        for (let l = 0; l < lineCount; l++) {
          const variant = weighted(rand, variants, variants.map((v) => (v.is_best_seller ? 3 : 1) * (v.size_ml === 50 ? 1.6 : 1)));
          const line = lines.get(variant.id) ?? { variant, quantity: 0 };
          line.quantity += rand() < 0.85 ? 1 : 2;
          lines.set(variant.id, line);
        }
        const subtotal = [...lines.values()].reduce((sum, l) => sum + l.variant.price_cents * l.quantity, 0);

        // Older orders have been delivered; recent ones are still on their way
        const age = (now - createdAt.getTime()) / DAY;
        const status = rand() < 0.07 ? 'cancelled' : age > 7 ? 'delivered' : age > 4 ? weighted(rand, ['shipped', 'delivered'], [2, 1]) : age > 1.5 ? weighted(rand, ['confirmed', 'shipped'], [1, 1]) : weighted(rand, ['pending', 'confirmed'], [2, 1]);

        const [order] = await q.query<{ id: number }>(
          `INSERT INTO orders (user_id, status, subtotal_cents, shipping_fee_cents, total_cents, ship_name, ship_phone, ship_address, created_at, updated_at)
           VALUES ($1, $2, $3, 5000, $4, $5, $6, $7, $8, $8) RETURNING id`,
          [customer.id, status, subtotal, subtotal + 5000, customer.name, customer.phone, customer.address, createdAt],
        );
        for (const { variant, quantity } of lines.values()) {
          await q.query(
            `INSERT INTO order_items (order_id, product_id, product_slug, name, size_ml, unit_price_cents, quantity, image_url)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
            [order!.id, variant.product_id, variant.slug, variant.name, variant.size_ml, variant.price_cents, quantity, variant.image_url],
          );
        }
        orderCount++;
      }
    }

    // Some customers leave reviews of what they bought
    await q.query(
      `INSERT INTO reviews (product_id, user_id, rating, comment, created_at)
       SELECT DISTINCT ON (oi.product_id, o.user_id) oi.product_id, o.user_id,
         (3 + floor(random() * 3))::smallint, '', o.created_at + interval '9 days'
       FROM order_items oi JOIN orders o ON o.id = oi.order_id
       JOIN users u ON u.id = o.user_id
       WHERE u.email LIKE $1 AND o.status = 'delivered' AND random() < 0.3 AND oi.product_id IS NOT NULL
       ON CONFLICT (product_id, user_id) DO NOTHING`,
      [`%@${DEMO_DOMAIN}`],
    );

    // Saved perfumes and carts that were never checked out
    for (const customer of customers) {
      if (rand() < 0.45) {
        for (let n = Math.floor(1 + rand() * 3); n > 0; n--) {
          const variant = weighted(rand, variants, variants.map((v) => (v.is_best_seller ? 2 : 1)));
          await q.query('INSERT INTO wishlist_items (user_id, product_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [customer.id, variant.product_id]);
        }
      }
      if (rand() < 0.15) {
        const variant = variants[Math.floor(rand() * variants.length)]!;
        await q.query('INSERT INTO cart_items (user_id, variant_id, quantity) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING', [customer.id, variant.id, rand() < 0.8 ? 1 : 2]);
      }
    }

    return { customers: customerCount, orders: orderCount };
  });
}

/** Removes the demo customers and their orders. */
export async function clearDemo(db: Db): Promise<void> {
  await db.tx(removeDemo);
}
