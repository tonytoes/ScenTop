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
  /** How many reverse proxies sit in front of the server (Render, Railway, Nginx = 1). */
  trustProxy: number;
  autoMigrate: boolean;
  /** Most database connections kept open at once. Neon's free plan allows a limited number. */
  dbPoolMax: number;
  bcryptRounds: number;
  /** Where the embedded dev database keeps its files. */
  devDataDir: string;
}

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
    trustProxy: Number(env.TRUST_PROXY) || 0,
    autoMigrate: env.AUTO_MIGRATE !== 'false',
    dbPoolMax: Number(env.DB_POOL_MAX) || 10,
    bcryptRounds: mode === 'test' ? 4 : 10,
    devDataDir: path.resolve(env.DEV_DATA_DIR || '.data/pglite'),
  };
}
