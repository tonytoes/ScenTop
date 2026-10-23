import os from 'node:os';
import path from 'node:path';

export interface Config {
  env: 'development' | 'production' | 'test';
  port: number;
  /** Neon / Postgres connection string. When empty (dev only) an embedded database is used. */
  databaseUrl: string | null;
  jwtSecret: string;
  /** Extra browser origins allowed to call the API (the Capacitor app origins are always allowed). */
  corsOrigins: string[];
  /** Folder with the built Angular app (`npm run build`). */
  staticDir: string;
  /** Folder with the built admin app (`npm run build:admin`), served under /admin. */
  adminStaticDir: string;
  /** How many reverse proxies sit in front of the server (Render, Railway, Nginx = 1). */
  trustProxy: number;
  autoMigrate: boolean;
  /** Most database connections kept open at once. Neon's free plan allows a limited number. */
  dbPoolMax: number;
  bcryptRounds: number;
  /** Where the embedded dev database keeps its files. */
  devDataDir: string;
  /** First admin account, created on start when the shop has no admin yet. Null skips it. */
  bootstrapAdmin: { email: string; password: string } | null;
}

// Development only: the admin you can log in with straight away. Production needs ADMIN_EMAIL and ADMIN_PASSWORD.
const DEV_ADMIN = { email: 'admin@scentop.local', password: 'admin12345' };

const DEV_SECRET = 'dev-only-secret-do-not-use-in-production';

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const mode = env.NODE_ENV === 'production' ? 'production' : env.NODE_ENV === 'test' ? 'test' : 'development';

  const jwtSecret = env.JWT_SECRET?.trim() || (mode === 'production' ? '' : DEV_SECRET);
  if (mode === 'production' && jwtSecret.length < 32) {
    throw new Error('JWT_SECRET must be set to a random string of at least 32 characters in production.');
  }

  const databaseUrl = env.DATABASE_URL?.trim() || null;
  if (mode === 'production' && !databaseUrl) {
    throw new Error('DATABASE_URL (your Neon connection string) must be set in production.');
  }

  return {
    env: mode,
    port: Number(env.PORT) || 3000,
    databaseUrl,
    jwtSecret,
    corsOrigins: (env.CORS_ORIGINS ?? '')
      .split(',')
      .map((origin) => origin.trim())
      .filter(Boolean),
    staticDir: path.resolve(env.STATIC_DIR || 'www'),
    adminStaticDir: path.resolve(env.ADMIN_STATIC_DIR || 'www-admin'),
    trustProxy: Number(env.TRUST_PROXY) || 0,
    autoMigrate: env.AUTO_MIGRATE !== 'false',
    dbPoolMax: Number(env.DB_POOL_MAX) || 10,
    bcryptRounds: mode === 'test' ? 4 : 10,
    // Kept in the user's home folder, not the project: folders synced by OneDrive/Dropbox lock database files
    devDataDir: path.resolve(env.DEV_DATA_DIR || path.join(os.homedir(), '.scentop', 'dev-db')),
    bootstrapAdmin: bootstrapAdmin(env, mode),
  };
}

function bootstrapAdmin(env: NodeJS.ProcessEnv, mode: Config['env']): Config['bootstrapAdmin'] {
  const email = env.ADMIN_EMAIL?.trim();
  const password = env.ADMIN_PASSWORD ?? '';
  if (email && password) {
    if (password.length < 8) throw new Error('ADMIN_PASSWORD must be at least 8 characters.');
    return { email, password };
  }
  return mode === 'development' ? DEV_ADMIN : null;
}
