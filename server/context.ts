import type { Config } from './config';
import type { Db } from './db';
import type { NeonGateway } from './lib/neon-auth';

/** Everything a route needs. Passed in explicitly so tests can use their own database. */
export interface AppContext {
  db: Db;
  config: Config;
  /** Optional dependency injection for deterministic auth tests. */
  neon?: NeonGateway;
}
