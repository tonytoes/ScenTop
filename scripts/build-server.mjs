// Compiles the Express server to dist-server/ and copies the SQL migrations next to it.
import { execSync } from 'node:child_process';
import { cpSync, rmSync } from 'node:fs';

rmSync('dist-server', { recursive: true, force: true });
execSync('npx tsc -p server/tsconfig.build.json', { stdio: 'inherit' });
cpSync('server/db/migrations', 'dist-server/db/migrations', { recursive: true });
console.log('Server built in dist-server/');
