// Bundles the Express server into api/index.js so Vercel can run it as a function (npm run build:api).
// The bundle is committed, so run this again after changing anything in server/.
import { build } from 'esbuild';

await build({
  entryPoints: ['server/vercel.ts'],
  outfile: 'api/index.js',
  bundle: true,
  platform: 'node',
  format: 'cjs',
  target: 'node22',
  // The built-in dev database is never used online
  external: ['@electric-sql/pglite', 'pg-native'],
  legalComments: 'none',
  // Vercel expects the function itself as the module export
  footer: { js: 'module.exports = module.exports.default;' },
});
console.log('API bundled into api/index.js');
