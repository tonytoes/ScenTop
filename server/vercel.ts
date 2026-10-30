import type { IncomingMessage, ServerResponse } from 'node:http';
import { createApp } from './app';
import { loadConfig } from './config';
import { createDb } from './db';

// Entry point for hosting the API as a Vercel function (bundled into api/index.js by npm run build:api).
// The database is migrated from the command line (npm run db:migrate), not on every cold start.
let app: Promise<ReturnType<typeof createApp>> | undefined;

export default async function handler(request: IncomingMessage, response: ServerResponse) {
  app ??= (async () => {
    const config = { ...loadConfig(), autoMigrate: false };
    return createApp({ db: await createDb(config), config });
  })();
  try {
    (await app)(request, response);
  } catch (error) {
    app = undefined;
    console.error('[api] Could not start:', error instanceof Error ? error.message : error);
    response.statusCode = 500;
    response.setHeader('Content-Type', 'application/json');
    response.end(JSON.stringify({ error: { message: 'The server could not start.' } }));
  }
}
