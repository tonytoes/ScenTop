import 'dotenv/config';
import { loadConfig } from './config';
import { createDb } from './db';
import { migrate } from './db/migrate';
import { seedCatalogue } from './db/seed';

// npm run db:migrate | db:seed | db:check
const commands: Record<string, (db: Awaited<ReturnType<typeof createDb>>) => Promise<void>> = {
  async migrate(db) {
    const applied = await migrate(db);
    console.log(applied.length ? `Applied: ${applied.join(', ')}` : 'Database is already up to date.');
  },
  async seed(db) {
    await migrate(db);
    console.log(`Saved ${await seedCatalogue(db)} perfumes.`);
  },
  async check(db) {
    const [info] = await db.query<{ version: string }>('SELECT version() AS version');
    console.log(`Connected (${db.kind}): ${info!.version}`);
  },
};

async function main() {
  const name = process.argv[2] ?? '';
  const command = commands[name];
  if (!command) {
    console.error(`Usage: cli.ts <${Object.keys(commands).join('|')}>`);
    process.exit(1);
  }

  const db = await createDb(loadConfig());
  try {
    await command(db);
  } finally {
    await db.close();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
