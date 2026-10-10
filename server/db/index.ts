import fs from 'node:fs';
import pg from 'pg';
import type { Config } from '../config';

// Rows come back as plain objects. Aggregates are cast to int/float8 in SQL
// because Postgres returns count(*) and numeric as strings.
export type Row = Record<string, any>;

export interface Queryable {
  query<T extends Row = Row>(sql: string, params?: unknown[]): Promise<T[]>;
  /** Runs several statements at once (migrations). No parameters. */
  exec(sql: string): Promise<void>;
}

export interface Db extends Queryable {
  kind: 'postgres' | 'pglite';
  /** Runs `fn` in a transaction; rolls back if it throws. */
  tx<T>(fn: (q: Queryable) => Promise<T>): Promise<T>;
  close(): Promise<void>;
}

function needsSsl(url: string): boolean {
  if (/sslmode=/i.test(url)) return false; // the connection string already decides
  const { hostname } = new URL(url);
  return !['localhost', '127.0.0.1', '::1'].includes(hostname);
}

/** Real Postgres, e.g. Neon. */
export function createPgDb(url: string, maxConnections = 10): Db {
  const pool = new pg.Pool({
    connectionString: url,
    max: maxConnections,
    idleTimeoutMillis: 30_000,
    // Neon pauses idle databases; the first query after a pause can take a few seconds.
    connectionTimeoutMillis: 20_000,
    ssl: needsSsl(url) ? { rejectUnauthorized: true } : undefined,
  });
  pool.on('error', (err) => console.error('[db] idle client error:', err.message));

  return {
    kind: 'postgres',
    async query(sql, params) {
      const result = await pool.query(sql, params as unknown[]);
      return result.rows;
    },
    async exec(sql) {
      await pool.query(sql);
    },
    async tx(fn) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const result = await fn({
          query: async (sql, params) => (await client.query(sql, params as unknown[])).rows,
          exec: async (sql) => void (await client.query(sql)),
        });
        await client.query('COMMIT');
        return result;
      } catch (error) {
        await client.query('ROLLBACK').catch(() => undefined);
        throw error;
      } finally {
        client.release();
      }
    },
    close: () => pool.end(),
  };
}

/** Embedded Postgres (WASM) for local development and tests. Never used in production. */
export async function createPgliteDb(dataDir?: string): Promise<Db> {
  const { PGlite } = await import('@electric-sql/pglite');
  if (dataDir) fs.mkdirSync(dataDir, { recursive: true });
  const db = new PGlite(dataDir);
  await db.waitReady;

  return {
    kind: 'pglite',
    async query(sql, params) {
      return (await db.query(sql, params as unknown[])).rows as never;
    },
    async exec(sql) {
      await db.exec(sql);
    },
    tx: (fn) =>
      db.transaction((t) =>
        fn({
          query: async (sql, params) => (await t.query(sql, params as unknown[])).rows as never,
          exec: async (sql) => void (await t.exec(sql)),
        }),
      ),
    close: () => db.close(),
  };
}

export async function createDb(config: Config): Promise<Db> {
  if (config.databaseUrl) return createPgDb(config.databaseUrl, config.dbPoolMax);

  if (config.env === 'production') throw new Error('DATABASE_URL is required in production.');
  console.log(`[db] No DATABASE_URL set - using the embedded dev database in ${config.devDataDir}`);
  return createPgliteDb(config.devDataDir);
}
