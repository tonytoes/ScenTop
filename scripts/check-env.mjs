// Runs before `npm start` and stops with a plain explanation if this computer is not ready.
import { connect } from 'node:net';

const problems = [];

const [major, minor] = process.versions.node.split('.').map(Number);
if (major < 22 || (major === 22 && minor < 12)) {
  problems.push(`Node ${process.versions.node} is too old. Install Node 22.12 or newer (24 is best) from https://nodejs.org, then run "npm install" again.`);
}

/** True when something is already listening on the port (on IPv4 or IPv6). */
function inUse(port) {
  const tryHost = (host) =>
    new Promise((resolve) => {
      const socket = connect({ port, host, timeout: 800 });
      socket.once('connect', () => (socket.destroy(), resolve(true)));
      socket.once('timeout', () => (socket.destroy(), resolve(false)));
      socket.once('error', () => resolve(false));
    });
  return Promise.all([tryHost('127.0.0.1'), tryHost('::1')]).then((results) => results.some(Boolean));
}

for (const [port, what] of [[3000, 'the ScenTop API'], [4200, 'the website']]) {
  if (await inUse(port)) {
    problems.push(`Port ${port} (needed for ${what}) is already in use by another program. Close it (often an old "npm start" or another project's dev server) and try again.`);
  }
}

if (problems.length > 0) {
  console.error('\nScenTop cannot start yet:\n');
  for (const problem of problems) console.error(`  - ${problem}`);
  console.error('');
  process.exit(1);
}
