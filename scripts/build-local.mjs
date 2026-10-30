import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { parse } from 'dotenv';

// Compile without contacting a deployment database, cache, mail or payment service.
// Runtime still reads the actual configuration when the user starts the app.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let configured = {};
try { configured = parse(readFileSync(path.join(root, '.env'))); } catch {}
const env = { ...process.env };
for (const name of new Set([...Object.keys(configured), ...Object.keys(env)])) {
  if (/^(DATABASE_|DIRECT_URL$|REDIS_|GMAIL_|GOOGLE_DRIVE_|CLOUDINARY_|B2_|EASYPAISA_|JAZZCASH_|EXPO_ACCESS_TOKEN$)/.test(name)) env[name] = '';
}
Object.assign(env, {
  NODE_ENV: 'production', DEPLOYMENT_ENV: 'local', NEXT_PHASE: 'phase-production-build',
  NEXT_TELEMETRY_DISABLED: '1', npm_lifecycle_event: 'build',
  DATABASE_URL: 'postgres://build:build@127.0.0.1:1/build',
  DIRECT_URL: 'postgres://build:build@127.0.0.1:1/build',
  REDIS_URL: 'redis://127.0.0.1:1',
  JWT_SECRET: randomBytes(32).toString('hex'),
  STREAMING_CREDENTIALS_SECRET: randomBytes(32).toString('hex'),
  CRON_SECRET: randomBytes(32).toString('hex'),
  NEXT_PUBLIC_APP_DOMAIN: configured.NEXT_PUBLIC_APP_DOMAIN || 'nisaab360.app',
  NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME: configured.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME || '',
  NODE_OPTIONS: '--max-old-space-size=3072',
});
console.info('Creating local production build with database/cache/provider access disabled.');
const child = spawn(process.execPath, ['scripts/build.mjs'], { cwd: root, env, stdio: 'inherit' });
child.on('error', () => { console.error('Could not start local build.'); process.exitCode = 1; });
child.on('exit', code => { process.exitCode = code ?? 1; });
