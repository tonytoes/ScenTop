import type { Express } from 'express';
import request from 'supertest';
import { createApp } from '../app';
import { loadConfig } from '../config';
import { createPgliteDb, type Db } from '../db';
import { migrate } from '../db/migrate';
import { seedCatalogue } from '../db/seed';

export interface TestApp {
  app: Express;
  db: Db;
}

/** A fresh app on its own in-memory Postgres, filled with the starter perfumes. */
export async function createTestApp(): Promise<TestApp> {
  const config = loadConfig({ NODE_ENV: 'test', JWT_SECRET: 'test-secret', STATIC_DIR: 'does-not-exist' });
  const db = await createPgliteDb();
  await migrate(db);
  await seedCatalogue(db);
  return { app: createApp({ db, config }), db };
}

let counter = 0;

export interface TestUser {
  id: number;
  email: string;
  token: string;
  /** Spread into supertest: request(app).get(url).set(user.auth) */
  auth: { Authorization: string };
}

export async function signUp(app: Express, overrides: Record<string, unknown> = {}): Promise<TestUser> {
  const email = `customer${++counter}@example.test`;
  const response = await request(app)
    .post('/api/auth/signup')
    .send({ firstName: 'Maria', lastName: 'Santos', email, phone: '0917 123 4567', password: 'secret-pass-1', ...overrides });
  if (response.status !== 201) throw new Error(`signup failed: ${JSON.stringify(response.body)}`);
  return { id: response.body.user.id, email, token: response.body.token, auth: { Authorization: `Bearer ${response.body.token}` } };
}

/** The id of a product's variant, e.g. variantId(app, 'deep-rouge', 50). */
export async function variantId(app: Express, slug: string, sizeMl: number): Promise<number> {
  const { body } = await request(app).get(`/api/products/${slug}`);
  return body.variants.find((variant: { sizeMl: number }) => variant.sizeMl === sizeMl).id;
}
