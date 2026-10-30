import { spawn, spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { parse } from 'dotenv';
import pg from 'pg';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// Preserve explicit production-stack commands; plain npm start runs locally.
if (process.argv.some(value => ['--backups', '--rebuild', '--prepare-only'].includes(value))) {
  await import('./start-local-docker.mjs');
} else {
  const savedPath = path.join(root, '.env.local-docker');
  const saved = existsSync(savedPath) ? parse(readFileSync(savedPath)) : {};
  if (!['DATABASE_RUNTIME_USER', 'DATABASE_RUNTIME_PASSWORD', 'VALKEY_PASSWORD', 'STREAMING_CREDENTIALS_SECRET'].every(key => saved[key])) {
    const result = spawnSync(process.execPath, ['scripts/start-local-docker.mjs', '--prepare-only'], {
      cwd: root, stdio: 'inherit', windowsHide: true, timeout: 15_000,
    });
    if (result.error || result.status !== 0) {
      console.error('Local configuration could not be prepared within 15 seconds. Check Docker Desktop; no images were built.');
      process.exit(result.status || 1);
    }
  }

  const configured = parse(readFileSync(path.join(root, '.env')));
  const local = parse(readFileSync(path.join(root, '.env.local-docker')));
  const composeEnv = { ...process.env, ...configured, ...local };
  const compose = ['compose', '--env-file', '.env', '--env-file', '.env.local-docker', '-f', 'docker-compose.yml', '-f', 'docker-compose.override.yml'];

  const runtimeUrl = new URL('postgres://127.0.0.1:6432/app');
  runtimeUrl.username = local.DATABASE_RUNTIME_USER;
  runtimeUrl.password = local.DATABASE_RUNTIME_PASSWORD;
  runtimeUrl.pathname = '/' + (configured.POSTGRES_DB || 'app');
  const directUrl = new URL(runtimeUrl);
  directUrl.port = '5433';
  const cacheUrl = new URL('redis://127.0.0.1:6379');
  cacheUrl.password = local.VALKEY_PASSWORD;
  const port = Number(process.env.PORT || 3000);
  if (!Number.isInteger(port) || port < 1024 || port > 65535) throw Error('PORT must be between 1024 and 65535.');
  const origin = `http://localhost:${port}`;
  const env = {
    ...composeEnv, NODE_ENV: 'development', DEPLOYMENT_ENV: 'local',
    NEXT_TELEMETRY_DISABLED: '1',
    DATABASE_URL: runtimeUrl.toString(), DIRECT_URL: directUrl.toString(), REDIS_URL: cacheUrl.toString(),
    NEXT_PUBLIC_APP_DOMAIN: 'localhost', APP_DOMAIN: 'localhost', PUBLIC_SITE_BASE_DOMAIN: 'localhost',
    API_ALLOWED_ORIGINS: origin, PAYMENT_PUBLIC_ORIGIN: origin,
    GOOGLE_DRIVE_CENTRAL_REDIRECT_URI: origin + '/api/sa/central-backup/google-drive/callback',
  };

  const docker = spawnSync('docker', ['info', '--format', '{{.ServerVersion}}'], {
    cwd: root, env: composeEnv, encoding: 'utf8', windowsHide: true, timeout: 8_000,
  });
  if (!docker.error && docker.status === 0) {
    const context = spawnSync('docker', ['context', 'inspect', '--format', '{{.Endpoints.docker.Host}}'], {
      cwd: root, env: composeEnv, encoding: 'utf8', windowsHide: true, timeout: 5_000,
    });
    const endpoint = composeEnv.DOCKER_HOST || context.stdout?.trim();
    if (!endpoint || !/^(?:npipe:\/\/|unix:\/\/|tcp:\/\/(?:127\.0\.0\.1|localhost):)/.test(endpoint)) throw Error('Local startup refuses a remote Docker context.');
    // The previously introduced Docker web stack owns port 3000. Stop only
    // this project's web/workers; leave its database and data volumes intact.
    const stopped = spawnSync('docker', [...compose, 'stop', '--timeout', '5', 'app', 'app2', 'caddy', 'push-receipt-worker', 'institution-restore-worker', 'payment-reconciliation-worker', 'postgres-backup'], {
      cwd: root, env: composeEnv, stdio: 'inherit', windowsHide: true, timeout: 20_000,
    });
    if (stopped.error || stopped.status !== 0) throw Error('Could not stop the previous local Docker web stack. No data volumes were removed.');
    console.info('Starting only PostgreSQL, PgBouncer and Valkey. No image builds or migrations.');
    const dependencies = spawnSync('docker', [...compose, 'up', '-d', '--no-build', '--wait', '--wait-timeout', '45', 'postgres', 'pgbouncer', 'valkey'], {
      cwd: root, env: composeEnv, stdio: 'inherit', windowsHide: true, timeout: 55_000,
    });
    if (dependencies.error || dependencies.status !== 0) throw Error('Local database/cache did not become healthy. Check Docker Desktop; npm start has not rebuilt any images.');
  } else {
    console.warn('This terminal cannot reach Docker. Checking the existing local database before starting.');
  }
  if (process.argv.includes('--deps-only')) process.exit(0);

  const database = new pg.Client({ connectionString: env.DATABASE_URL, connectionTimeoutMillis: 4_000, query_timeout: 4_000 });
  try {
    await database.connect();
    await database.query('SELECT 1');
  } catch {
    console.error('Local PostgreSQL is not responding. Restart Docker Desktop, then run npm start. Startup stopped without building images or changing data.');
    process.exitCode = 1;
  } finally {
    await database.end().catch(() => {});
  }
  if (process.exitCode) process.exit(process.exitCode);

  console.info(`Starting the local app: ${origin}/login/super-admin`);
  console.info('Pages compile as you open them. Source changes update automatically. Ctrl+C stops the local app.');
  const server = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'dev', '--webpack', '--hostname', '127.0.0.1', '--port', String(port)], {
    cwd: root, env, stdio: 'inherit', windowsHide: true,
  });
  server.once('error', error => { console.error('Could not start the local app:', error.message); process.exitCode = 1; });
  server.once('exit', code => { process.exitCode = code ?? 0; });
  for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => server.kill(signal));
}
