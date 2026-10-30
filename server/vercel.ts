import type { IncomingMessage, ServerResponse } from 'node:http';
import { createApp } from './app';
import { loadConfig } from './config';
import { createDb } from './db';

// Entry point for hosting the API as a Vercel function (bundled into api/index.js by npm run build:api).
// The database is migrated from the command line (npm run db:migrate), not on every cold start.
let app: Promise<ReturnType<typeof createApp>> | undefined;

async function start() {
  // Setup mistakes (a missing setting) are reported by name, so they can be fixed from the Vercel dashboard
  let config;
  try {
    config = { ...loadConfig(), autoMigrate: false };
  } catch (error) {
    throw new StartError(`Server setup problem: ${error instanceof Error ? error.message : error}`);
  }
  try {
    return createApp({ db: await createDb(config), config });
  } catch (error) {
    console.error('[api] Database error:', error);
    throw new StartError('The database could not be reached. Check DATABASE_URL in the Vercel settings.');
  }
}

class StartError extends Error {}

export default async function handler(request: IncomingMessage, response: ServerResponse) {
  app ??= start();
  try {
    (await app)(request, response);
  } catch (error) {
    app = undefined;
    console.error('[api] Could not start:', error instanceof Error ? error.message : error);
    response.statusCode = 500;
    response.setHeader('Content-Type', 'application/json');
    response.end(JSON.stringify({ error: { message: error instanceof StartError ? error.message : 'The server could not start.' } }));
  }
}
