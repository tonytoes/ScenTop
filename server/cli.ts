import 'dotenv/config';
import { loadConfig } from './config';
import { createDb } from './db';
import { migrate } from './db/migrate';
import { seedCatalogue, seedIfEmpty } from './db/seed';
import { clearDemo, createAdmin, makeAdmin, seedDemo } from './db/admin';

// npm run db:migrate | db:seed | db:check | db:demo | db:demo-clear | admin:make -- <email> | admin:create
const commands: Record<string, (db: Awaited<ReturnType<typeof createDb>>) => Promise<void>> = {
  async migrate(db) {
    const applied = await migrate(db);
    console.log(applied.length ? `Applied: ${applied.join(', ')}` : 'Database is already up to date.');
  },
  async seed(db) {
    await migrate(db);
    console.log(`Saved ${await seedCatalogue(db)} perfumes.`);
  },
  async demo(db) {
    await migrate(db);
    await seedIfEmpty(db);
    const { customers, orders } = await seedDemo(db);
    console.log(`Added ${customers} demo customers and ${orders} demo orders (accounts ending in @demo.scentop.local).`);
  },
  async 'demo-clear'(db) {
    await clearDemo(db);
    console.log('Removed the demo customers and their orders.');
  },
  async 'make-admin'(db) {
    const email = process.argv[3] ?? '';
    if (!email) throw new Error('Usage: npm run admin:make -- someone@example.com');
    await migrate(db);
    console.log((await makeAdmin(db, email)) ? `${email} is now an admin.` : `No account uses ${email}. Sign up on the website first.`);
  },
  // Reads the details from environment variables so passwords never need shell quoting (the launcher sets them)
  async 'create-admin'(db) {
    const email = process.env.SCENTOP_ADMIN_EMAIL?.trim() ?? '';
    const password = process.env.SCENTOP_ADMIN_PASSWORD ?? '';
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new Error('Enter a valid e-mail address.');
    if (password.length < 8) throw new Error('The password needs at least 8 characters.');
    await migrate(db);
    const result = await createAdmin(db, loadConfig(), email, password, process.env.SCENTOP_ADMIN_NAME);
    console.log(result === 'created' ? `Created the admin account ${email}.` : `${email} already had an account: it is now an admin with the new password.`);
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
