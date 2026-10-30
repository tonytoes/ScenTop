import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../app';
import { loadConfig } from '../config';
import { createPgliteDb, type Db } from '../db';

// A tiny fake build of the Angular app
let dir: string;
let db: Db;
let app: ReturnType<typeof createApp>;

beforeAll(async () => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'scentop-www-'));
  fs.mkdirSync(path.join(dir, 'assets'));
  fs.writeFileSync(path.join(dir, 'index.html'), '<!doctype html><title>ScenTop</title><app-root></app-root>');
  fs.writeFileSync(path.join(dir, 'main-ABCDEFGH.js'), 'console.log(1)');
  fs.writeFileSync(path.join(dir, 'assets', 'logo.png'), 'png');

  db = await createPgliteDb();
  app = createApp({ db, config: loadConfig({ NODE_ENV: 'test', STATIC_DIR: dir }) });
});

afterAll(async () => {
  await db.close();
  fs.rmSync(dir, { recursive: true, force: true });
});

describe('serving the web app', () => {
  it('opens deep links by sending index.html, so refreshing /product/deep-rouge works', async () => {
    const response = await request(app).get('/product/deep-rouge');
    expect(response.status).toBe(200);
    expect(response.text).toContain('<app-root>');
    expect(response.headers['cache-control']).toBe('no-cache');
  });

  it('never caches index.html, so a new release shows up straight away', async () => {
    expect((await request(app).get('/index.html')).headers['cache-control']).toBe('no-cache');
  });

  it('caches hashed files for a year', async () => {
    expect((await request(app).get('/main-ABCDEFGH.js')).headers['cache-control']).toBe('public, max-age=31536000, immutable');
  });

  it('caches images and other plain files for a day', async () => {
    expect((await request(app).get('/assets/logo.png')).headers['cache-control']).toBe('public, max-age=86400');
  });

  it('answers 404 for a missing file instead of sending the app', async () => {
    const response = await request(app).get('/assets/missing.png');
    expect(response.status).toBe(404);
    expect(response.text).not.toContain('<app-root>');
  });

  it('keeps API errors as JSON', async () => {
    const response = await request(app).get('/api/nope');
    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe('not_found');
  });

  it('sends security headers', async () => {
    const { headers } = await request(app).get('/');
    expect(headers['content-security-policy']).toContain("script-src 'self'");
    expect(headers['content-security-policy']).toContain("frame-ancestors 'none'");
    expect(headers['x-content-type-options']).toBe('nosniff');
    expect(headers['x-powered-by']).toBeUndefined();
  });

  it('lets the mobile app call the API but not other websites', async () => {
    const fromApp = await request(app).get('/api/health').set('Origin', 'https://localhost');
    expect(fromApp.headers['access-control-allow-origin']).toBe('https://localhost');

    const fromElsewhere = await request(app).get('/api/health').set('Origin', 'https://evil.example');
    expect(fromElsewhere.headers['access-control-allow-origin']).toBeUndefined();
  });
});
