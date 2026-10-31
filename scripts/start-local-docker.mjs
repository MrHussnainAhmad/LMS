import { spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { readFileSync, writeFileSync, mkdirSync, openSync, closeSync, unlinkSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'dotenv';
import { encryptCentralDump } from '../src/lib/central-backup-crypto.ts';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const runtimePath = path.join(root, '.env.local-docker');
const privateDirectory = path.join(root, '.codex', 'local-docker');
const configured = parse(readFileSync(path.join(root, '.env')));
for (const name of ['DATABASE_URL', 'DIRECT_URL', 'REDIS_URL']) {
  if (!configured[name]) continue;
  const url = new URL(configured[name]);
  if (!['127.0.0.1', 'localhost', '[::1]', 'postgres', 'pgbouncer', 'valkey'].includes(url.hostname)) {
    throw Error(`Refusing local startup: ${name} points outside local Docker/loopback services.`);
  }
}
let saved = {};
if (existsSync(runtimePath)) saved = parse(readFileSync(runtimePath));
const secret = () => randomBytes(32).toString('hex');
const operator = new URL('postgres://postgres:5432/app');
operator.username = configured.POSTGRES_USER || 'app';
operator.password = configured.POSTGRES_PASSWORD || '';
operator.pathname = '/' + (configured.POSTGRES_DB || 'app');
if (!operator.password) throw Error('Set POSTGRES_PASSWORD in the private local .env first.');
const local = {
  DATABASE_RUNTIME_USER: configured.DATABASE_RUNTIME_USER || saved.DATABASE_RUNTIME_USER || 'nisaab_runtime',
  DATABASE_RUNTIME_PASSWORD: configured.DATABASE_RUNTIME_PASSWORD || saved.DATABASE_RUNTIME_PASSWORD || secret(),
  VALKEY_PASSWORD: configured.VALKEY_PASSWORD || saved.VALKEY_PASSWORD || secret(),
  STREAMING_CREDENTIALS_SECRET: configured.STREAMING_CREDENTIALS_SECRET || saved.STREAMING_CREDENTIALS_SECRET || secret(),
  STREAMING_CREDENTIALS_LEGACY_SECRET: configured.STREAMING_CREDENTIALS_LEGACY_SECRET || saved.STREAMING_CREDENTIALS_LEGACY_SECRET || configured.JWT_SECRET || '',
  STREAMING_CREDENTIALS_KEY_ID: configured.STREAMING_CREDENTIALS_KEY_ID || saved.STREAMING_CREDENTIALS_KEY_ID || 'primary',
  CRON_SECRET: configured.CRON_SECRET || saved.CRON_SECRET || secret(),
  LOCAL_OPERATOR_DATABASE_URL: operator.toString(),
  LOCAL_MIGRATION_BACKUP_KEY: saved.LOCAL_MIGRATION_BACKUP_KEY || secret(),
};
for (const key of ['DATABASE_RUNTIME_PASSWORD', 'VALKEY_PASSWORD']) if (!/^[a-f0-9]{64,128}$/i.test(local[key])) throw Error(`${key} must be a private 64+ character hex value.`);
if (!configured.JWT_SECRET || configured.JWT_SECRET.length < 32) throw Error('The existing local JWT_SECRET must contain at least 32 characters.');
for (const value of Object.values(local)) if (/[\r\n']/.test(value)) throw Error('Local generated settings must be single-line values without single quotes.');
mkdirSync(privateDirectory, { recursive: true, mode: 0o700 });
writeFileSync(runtimePath, '# Local testing only; generated secrets. Do not share or commit.\n' + Object.entries(local).map(([key,value]) => `${key}='${value}'`).join('\n') + '\n', { mode: 0o600 });
const env = { ...process.env, ...configured, ...local };
const compose = ['compose', '--env-file', '.env', '--env-file', '.env.local-docker', '-f', 'docker-compose.yml', '-f', 'docker-compose.override.yml', '-f', 'deployment/compose.local-test.yml'];
function run(args, title, options = {}) {
  console.info(title);
  const result = spawnSync('docker', args, { cwd: root, env, stdio: 'inherit', windowsHide: true, ...options });
  if (result.error || result.status !== 0) throw Error(`${title} failed. Existing database volumes were preserved.`);
}
run([...compose, 'config', '--quiet'], 'Validating local Compose configuration');
if (process.argv.includes('--prepare-only')) {
  console.info('Local overlay prepared. No Docker services or migrations were started.');
  process.exit(0);
}
const info = spawnSync('docker', ['info', '--format', '{{.ServerVersion}}'], { env, encoding: 'utf8', windowsHide: true });
if (info.error || info.status !== 0) {
  throw Error('Docker Desktop may be running, but this terminal cannot access its API. Run this command from your normal PowerShell terminal with Docker Desktop access.');
}
const context = spawnSync('docker', ['context', 'inspect', '--format', '{{.Endpoints.docker.Host}}'], {env,encoding:'utf8',windowsHide:true});
const endpoint = env.DOCKER_HOST || context.stdout?.trim();
if (!endpoint || !/^(?:npipe:\/\/|unix:\/\/|tcp:\/\/(?:127\.0\.0\.1|localhost):)/.test(endpoint)) throw Error('Local testing refuses a remote Docker context.');

// An ordinary start must never rebuild the web app or stop it for migrations.
// Configuration is captured privately because resolved Compose JSON has secrets.
const resolved = spawnSync('docker', [...compose, 'config', '--format', 'json'], { cwd: root, env, encoding: 'utf8', windowsHide: true, maxBuffer: 4 * 1024 * 1024 });
if (resolved.error || resolved.status !== 0) throw Error('Could not resolve local Compose services.');
const model = JSON.parse(resolved.stdout);
function hasImage(service) {
  const image = model.services[service]?.image || `${model.name}-${service}`;
  const result = spawnSync('docker', ['image', 'inspect', image], { cwd: root, env, stdio: 'ignore', windowsHide: true });
  return !result.error && result.status === 0;
}
if (!process.argv.includes('--rebuild')) {
  if (!hasImage('app') || !hasImage('app2')) {
    throw Error('Local web images are missing. Run npm start -- --rebuild once for initial setup.');
  }
  if (!hasImage('postgres-backup')) {
    run([...compose, 'build', 'postgres-backup'], 'Building only the missing backup worker image; the website is not rebuilt');
  }
  run([...compose, 'up', '-d', '--no-build', '--wait', 'postgres', 'pgbouncer', 'valkey'], 'Starting existing database and cache services (no rebuild)');
  run([...compose, 'up', '-d', '--no-build', '--no-deps', '--wait', 'postgres-backup'], 'Starting the backup service for Back up now');
  run([...compose, 'up', '-d', '--no-build', '--no-deps', '--wait', 'app', 'app2', 'caddy'], 'Starting the existing web images (no build or migrations)');
  console.info('Local website: https://localhost/login/super-admin');
  console.info('Using the last built version. To apply source changes or migrations, run npm start -- --rebuild.');
  process.exit(0);
}

run([...compose, 'build', 'migrate', 'app', 'app2', 'backup-volume-init', 'postgres-backup'], 'Building updated local Docker images');
run([...compose, 'stop', 'app', 'app2', 'push-receipt-worker', 'institution-restore-worker', 'payment-reconciliation-worker', 'postgres-backup'], 'Stopping only this local stack before migration');
run([...compose, 'up', '-d', '--wait', 'postgres'], 'Starting the local PostgreSQL service');
const stamp = new Date().toISOString().replace(/[:.]/g,'-');
const raw = path.join(privateDirectory, `before-migration-${stamp}.dump`);
const encrypted = raw + '.enc';
let fd = openSync(raw, 'wx', 0o600);
try {
  run([...compose, 'exec', '-T', 'postgres', 'sh', '-c', 'PGPASSWORD="$POSTGRES_PASSWORD" exec pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" --format=custom --no-owner --no-acl'], 'Saving a private migration safety snapshot', {stdio:['ignore',fd,'inherit']});
} finally { closeSync(fd); }
fd = openSync(raw, 'r');
try { run([...compose, 'exec', '-T', 'postgres', 'pg_restore', '--list'], 'Checking snapshot catalog', {stdio:[fd,'ignore','inherit']}); } finally { closeSync(fd); }
await encryptCentralDump(raw, encrypted, local.LOCAL_MIGRATION_BACKUP_KEY);
unlinkSync(raw);
console.info(`Encrypted migration safety copy: ${encrypted}. Its key is in the private .env.local-docker file.`);
run([...compose, 'run', '--rm', '--no-deps', 'migrate'], 'Applying current local migrations');
run([...compose, 'run', '--rm', '--no-deps', '--volume', `${path.join(root,'scripts','provision-runtime-role.mjs')}:/app/scripts/provision-runtime-role.mjs:ro`, '-e', 'DATABASE_RUNTIME_USER', '-e', 'DATABASE_RUNTIME_PASSWORD', 'migrate', 'node', 'scripts/provision-runtime-role.mjs', '--apply'], 'Provisioning the restricted local runtime role');
run([...compose, 'run', '--rm', '--no-deps', 'backup-volume-init'], 'Preparing the private backup volume');
run([...compose, 'up', '-d', '--wait', 'pgbouncer', 'valkey'], 'Starting local pooled database and cache services');
run([...compose, 'up', '-d', '--no-deps', '--wait', 'postgres-backup'], 'Starting the backup service for Back up now');
run([...compose, 'up', '-d', '--no-deps', '--wait', 'app', 'app2', 'caddy'], 'Starting the local web build');
console.info('Local build is ready: https://localhost/login/super-admin');
console.info('Accept the local Caddy certificate if prompted. Existing accounts remain; security migrations require signing in again.');
console.info('Back up now starts directly from the page. Other mail/payment/school workers stay stopped.');
