import fs from 'node:fs';
import path from 'node:path';
import type { Db } from './index';

const MIGRATIONS_DIR = path.join(__dirname, 'migrations');
// Any constant works; it only has to be the same on every server instance.
const MIGRATION_LOCK_ID = 727_274;

/** Applies every .sql file in migrations/ that has not run yet, in file-name order. */
export async function migrate(db: Db): Promise<string[]> {
  await db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      name        text PRIMARY KEY,
      applied_at  timestamptz NOT NULL DEFAULT now()
    )
  `);

  const files = fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((file) => file.endsWith('.sql'))
    .sort();

  const applied: string[] = [];
  for (const file of files) {
    const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8');

    await db.tx(async (q) => {
      // Stops two servers starting at the same time from running the same migration twice.
      if (db.kind === 'postgres') await q.query('SELECT pg_advisory_xact_lock($1)', [MIGRATION_LOCK_ID]);

      const done = await q.query('SELECT 1 FROM schema_migrations WHERE name = $1', [file]);
      if (done.length > 0) return;

      await q.exec(sql);
      await q.query('INSERT INTO schema_migrations (name) VALUES ($1)', [file]);
      applied.push(file);
    });
  }
  return applied;
}
