import 'dotenv/config';
import { createApp } from './app';
import { loadConfig } from './config';
import { createDb } from './db';
import { migrate } from './db/migrate';
import { seedIfEmpty } from './db/seed';

async function main() {
  const config = loadConfig();
  const db = await createDb(config);

  if (config.autoMigrate) {
    const applied = await migrate(db);
    if (applied.length > 0) console.log(`[db] Applied migrations: ${applied.join(', ')}`);
    if (await seedIfEmpty(db)) console.log('[db] Empty catalogue - added the starter perfumes');
  }

  const server = createApp({ db, config }).listen(config.port, () => {
    console.log(`[server] ScenTop is running on http://localhost:${config.port} (${config.env}, ${db.kind})`);
  });

  server.on('error', (error: NodeJS.ErrnoException) => {
    if (error.code === 'EADDRINUSE') {
      console.error(`[server] Port ${config.port} is already used by another program. Close it, or start with a different PORT (the Angular dev server in proxy.conf.json expects 3000).`);
    } else {
      console.error('[server] Server error:', error.message);
    }
    process.exit(1);
  });

  const shutdown = () => {
    console.log('[server] Shutting down...');
    server.close(() => void db.close().then(() => process.exit(0)));
    setTimeout(() => process.exit(1), 10_000).unref();
  };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

main().catch((error) => {
  console.error('[server] Could not start:', error instanceof Error ? error.message : error);
  process.exit(1);
});
