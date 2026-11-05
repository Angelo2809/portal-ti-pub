import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const env = { ...process.env, DB_HOST: '', DB_DRIVER: 'sqlite', DEMO_MODE: 'true',
  PORTAL_DB_PATH: path.join(root, 'data', 'demo.sqlite'), COOKIE_SECURE: 'false', HOST: '127.0.0.1' };
const serve = process.argv.includes('--serve');
// Use Node entry points directly so this works on Windows, macOS and Linux.
const args = serve ? ['server/index.js'] : ['node_modules/concurrently/dist/bin/concurrently.js', '--kill-others',
  'node --watch server/index.js', 'node node_modules/vite/bin/vite.js --host 127.0.0.1'];
const child = spawn(process.execPath, args, { cwd: root, env, stdio: 'inherit' });
child.on('error', error => { console.error(error.message); process.exitCode = 1; });
child.on('exit', code => { process.exitCode = code ?? 0; });
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => child.kill(signal));
