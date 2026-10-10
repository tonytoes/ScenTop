import type { Config } from './config';
import type { Db } from './db';

/** Everything a route needs. Passed in explicitly so tests can use their own database. */
export interface AppContext {
  db: Db;
  config: Config;
}
