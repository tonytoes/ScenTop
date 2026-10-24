import { createAuthClient } from '@neondatabase/auth';
import { BetterAuthVanillaAdapter } from '@neondatabase/auth/vanilla/adapters';
import { environment } from '../../environments/environment';

function makeClient() {
  return createAuthClient(environment.neonAuthUrl, {
    adapter: BetterAuthVanillaAdapter({ fetchOptions: { credentials: 'include' } }),
  });
}
let client: ReturnType<typeof makeClient> | undefined;
/** Lazily constructed so password login works before Neon is configured. */
export function getNeonAuth() {
  if (!environment.neonAuthUrl) throw new Error('Neon Auth is not configured.');
  return client ??= makeClient();
}
