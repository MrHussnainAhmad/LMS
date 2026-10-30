// Offline fixtures only. Never loads .env or contacts Drive/AWS.
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdtemp, rm, stat, access } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { createCipheriv, randomBytes, scryptSync } from 'node:crypto';
import { EventEmitter } from 'node:events';
import { execFileSync } from 'node:child_process';
import { test } from 'node:test';
import { PGlite } from '@electric-sql/pglite';
import { pg_trgm } from '@electric-sql/pglite/contrib/pg_trgm';
import { getTableConfig, PgDialect, type PgTable } from 'drizzle-orm/pg-core';
import { build } from 'esbuild';
import { NextRequest } from 'next/server';
import { SignJWT } from 'jose';
import * as schema from '../src/db/schema';
import { encryptCentralDump, decryptCentralDump, backupFileSha256 } from '../src/lib/central-backup-crypto';

const require = createRequire(import.meta.url);
const targetTables = [schema.centralDatabaseBackups, schema.centralBackupSettings, schema.centralBackupJobs, schema.institutionBackups,
  schema.institutionGoogleDriveBackups, schema.institutionRestoreRequests];
const repairName = '0076_central_backup_reconciliation.sql';

type Query = (sql: string, params?: unknown[]) => Promise<{ rows: Record<string, unknown>[] }>;
async function verifySchema(query: Query) {
  const { rows } = await query(`SELECT table_name,column_name,data_type,udt_name,character_maximum_length,is_nullable,column_default
    FROM information_schema.columns WHERE table_schema='public'`);
  const { rows: indexes } = await query("SELECT tablename,indexname,indexdef FROM pg_indexes WHERE schemaname='public'");
  const { rows: constraints } = await query("SELECT conname FROM pg_constraint c JOIN pg_namespace n ON n.oid=c.connamespace WHERE n.nspname='public'");
  for (const table of targetTables) {
    const config = getTableConfig(table), dialect = new PgDialect();
    for (const column of config.columns) {
      const actual = rows.find(row => row.table_name === config.name && row.column_name === column.name);
      assert.ok(actual, `Missing ${config.name}.${column.name}`);
      const expectedType = column.getSQLType();
      const actualType = actual.data_type === 'character varying' ? `varchar(${actual.character_maximum_length})`
        : actual.data_type === 'timestamp with time zone' ? 'timestamp with time zone'
          : actual.data_type === 'timestamp without time zone' ? 'timestamp' : actual.data_type;
      assert.equal(actualType, expectedType === 'serial' ? 'integer' : expectedType, `Type drift ${config.name}.${column.name}`);
      assert.equal(actual.is_nullable, column.notNull ? 'NO' : 'YES', `Nullability drift ${config.name}.${column.name}`);
      if (column.default !== undefined && column.columnType !== 'PgSerial') {
        const expected = typeof column.default === 'object' ? dialect.sqlToQuery(column.default as Parameters<typeof dialect.sqlToQuery>[0]).sql : String(column.default);
        assert.ok(String(actual.column_default).includes(expected), `Default drift ${config.name}.${column.name}: ${actual.column_default} vs ${expected}`);
      }
    }
    for (const index of config.indexes) {
      const actual = indexes.find(row => row.tablename === config.name && row.indexname === index.config.name);
      assert.ok(actual, `Missing index ${index.config.name}`);
      for (const col of index.config.columns) if ('name' in col && col.name) assert.ok(String(actual.indexdef).includes(col.name), `Wrong index column ${index.config.name}`);
      if (index.config.unique) assert.match(String(actual.indexdef), /UNIQUE/);
    }
    for (const check of config.checks) assert.ok(constraints.some(row => row.conname === check.name), `Missing check ${check.name}`);
  }
}

async function freshMigrations(memory: PGlite) {
  const journal = JSON.parse(await readFile('drizzle/meta/_journal.json','utf8'));
  for (const entry of journal.entries) await memory.exec(await readFile(`drizzle/${entry.tag}.sql`, 'utf8'));
  const runner = await readFile('scripts/migrate-production.mjs','utf8');
  const list = runner.match(/const SUPPLEMENTAL_MIGRATIONS = (\[[\s\S]*?\]);/)![1].replace(/\/\/[^\n]*/g,'');
  const files = JSON.parse(list.replace(/,\s*\]/, ']')) as string[];
  assert.ok(files.includes(repairName), 'Repair must be part of the normal migration runner');
  await memory.exec('CREATE TABLE nisaab360_supplemental_migrations(name text PRIMARY KEY,sha256 text NOT NULL,applied_at timestamptz NOT NULL DEFAULT now())');
  for (const file of files) {
    try {
      const sql=await readFile(`drizzle/${file}`, 'utf8');
      if (/CREATE\s+(?:UNIQUE\s+)?INDEX\s+CONCURRENTLY/i.test(sql)) {
        for (const statement of sql.replace(/^\s*--.*$/gm,'').split(';').map(value=>value.trim()).filter(Boolean)) await memory.exec(statement);
      } else await memory.exec(sql);
      await memory.query('INSERT INTO nisaab360_supplemental_migrations(name,sha256) VALUES($1,$2)',[file,'fixture']);
    }
    catch (error) { throw new Error(`Fresh migration failed: ${file}`, { cause: error }); }
  }
}

test('fresh actual migration chain matches backup/restore Drizzle definitions; audit all table columns', async () => {
  const memory = await PGlite.create({ extensions: { pg_trgm } });
  try {
    await freshMigrations(memory);
    await verifySchema((sql, params) => memory.query(sql, params));
    // Audit the rest without inventing tables from Drizzle: missing columns are
    // deployment-breaking and fail the gate, even outside the backup tables.
    const columns = await memory.query<{ table_name: string; column_name: string }>("SELECT table_name,column_name FROM information_schema.columns WHERE table_schema='public'");
    const actual = new Set(columns.rows.map(row => `${row.table_name}.${row.column_name}`));
    const missing: string[] = [];
    for (const value of Object.values(schema)) {
      let config; try { config = getTableConfig(value as PgTable); } catch { continue; }
      for (const column of config.columns) if (!actual.has(`${config.name}.${column.name}`)) missing.push(`${config.name}.${column.name}`);
    }
    assert.deepEqual(missing, [], 'Migration-created schema is missing application columns');
    // Removing device allowances must still enforce the remaining deal terms.
    await memory.exec(`INSERT INTO subscription_plans
      (id,kind,name,student_count,student_limit,per_student_fee_paisa,monthly_fee_paisa)
      VALUES ('NO_DEVICE_LIMIT','DEAL','No device allowance',10,20,100,1000)`);
    await memory.exec("UPDATE subscription_plans SET device_limit=1 WHERE id='NO_DEVICE_LIMIT'");
    const removeDeviceLimits = await readFile('drizzle/0085_remove_plan_device_limits.sql', 'utf8');
    await memory.exec(removeDeviceLimits);
    await memory.exec(removeDeviceLimits);
    const { rows: [legacyPlan] } = await memory.query<{ device_limit: number }>("SELECT device_limit FROM subscription_plans WHERE id='NO_DEVICE_LIMIT'");
    assert.equal(legacyPlan.device_limit, 1, 'Retain historical plan data without enforcing it');
    await memory.exec("UPDATE subscription_plans SET device_limit=NULL WHERE id='NO_DEVICE_LIMIT'");
    await assert.rejects(() => memory.exec("UPDATE subscription_plans SET student_limit=NULL WHERE id='NO_DEVICE_LIMIT'"));
    await assert.rejects(() => memory.exec("UPDATE subscription_plans SET monthly_fee_paisa=999 WHERE id='NO_DEVICE_LIMIT'"));
    await memory.exec(await readFile(`drizzle/${repairName}`, 'utf8'));
    await verifySchema((sql, params) => memory.query(sql, params));
  } finally { await memory.close(); }
});

test('legacy upgrade and manually patched production preserve history and long identifiers; repair is idempotent', async () => {
  for (const patched of [false, true]) {
    const memory = await PGlite.create();
    try {
      await memory.exec(await readFile('drizzle/0060_central_database_backups.sql','utf8'));
      await memory.exec(`INSERT INTO central_database_backups(run_id,file_name,error_message) VALUES('${'x'.repeat(200)}','${'y'.repeat(300)}','historical failure');`);
      if (patched) await memory.exec("ALTER TABLE central_database_backups ADD COLUMN b2_status varchar(16), ADD COLUMN error text; UPDATE central_database_backups SET error='newer error'");
      const sql = await readFile(`drizzle/${repairName}`, 'utf8'); await memory.exec(sql); await memory.exec(sql);
      const { rows: [row] } = await memory.query<Record<string, unknown>>('SELECT * FROM central_database_backups');
      assert.equal(row.error, patched ? 'newer error' : 'historical failure'); assert.equal(row.error_message, 'historical failure');
      assert.equal(String(row.run_id).length,200); assert.equal(String(row.file_name).length,300); assert.equal(row.status,'UPLOADING');
      await assert.rejects(() => memory.exec("UPDATE central_database_backups SET status='INVALID'"));
      await assert.rejects(() => memory.exec("UPDATE central_database_backups SET b2_status='INVALID'"));
    } finally { await memory.close(); }
  }
});

test('stream encryption interoperates with legacy envelope; corruption/wrong password never publish plaintext', async () => {
  const dir = await mkdtemp(path.join(tmpdir(),'n360-crypto-'));
  try {
    const raw=path.join(dir,'source'), encrypted=path.join(dir,'encrypted'), output=path.join(dir,'restored');
    const password='  original UI password  '; const content=randomBytes(3*1024*1024);
    await writeFile(raw,content); await encryptCentralDump(raw,encrypted,password);
    await decryptCentralDump(encrypted,output,password); assert.deepEqual(await readFile(output),content);
    await assert.rejects(()=>encryptCentralDump(raw,encrypted,password));
    await assert.rejects(()=>decryptCentralDump(encrypted,path.join(dir,'wrong'),'wrong password'));
    await assert.rejects(()=>access(path.join(dir,'wrong')));
    const broken=await readFile(encrypted);broken[broken.length-1]^=1;await writeFile(path.join(dir,'broken'),broken);
    await assert.rejects(()=>decryptCentralDump(path.join(dir,'broken'),path.join(dir,'corrupt'),password));
    await assert.rejects(()=>access(path.join(dir,'corrupt')));
    const cancelled=new AbortController();cancelled.abort();
    await assert.rejects(()=>encryptCentralDump(raw,path.join(dir,'cancelled'),password,cancelled.signal));
    await assert.rejects(()=>access(path.join(dir,'cancelled')));
    await assert.rejects(()=>backupFileSha256(raw,cancelled.signal));
    const salt=randomBytes(16),iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',scryptSync(password,salt,32,{N:16384,r:8,p:1}),iv);
    const ciphertext=Buffer.concat([cipher.update(content),cipher.final()]);
    await writeFile(path.join(dir,'legacy'),Buffer.concat([Buffer.from('N360GCM1'),salt,iv,cipher.getAuthTag(),ciphertext]));
    await decryptCentralDump(path.join(dir,'legacy'),path.join(dir,'legacy-restored'),password);
    assert.deepEqual(await readFile(path.join(dir,'legacy-restored')),content);
    if(process.platform!=='win32') assert.equal((await stat(encrypted)).mode & 0o777,0o600);
  } finally { await rm(dir,{recursive:true,force:true}); }
});

test('Compose orders migration/volume initialization; runtime identity and retention configuration agree', async () => {
  const yaml=require('js-yaml');const compose=yaml.load(await readFile('docker-compose.yml','utf8'));
  for(const name of ['app','app2']) {
    assert.equal(compose.services[name].depends_on['backup-volume-init'].condition,'service_completed_successfully');
    assert.equal(compose.services[name].depends_on.migrate.condition,'service_completed_successfully');
    assert.equal(compose.services[name].environment.CENTRAL_DATABASE_BACKUP_KEEP_DAILY,undefined);
  }
  assert.equal(compose.services['backup-volume-init'].network_mode,'none');
  for (const name of ['app','app2']) assert.equal(compose.services[name].depends_on['postgres-backup'].condition,'service_healthy');
  assert.equal(compose.services['postgres-backup'].depends_on.app,undefined);
  assert.equal(compose.services['postgres-backup'].depends_on.app2,undefined);
  assert.equal(compose.services['postgres-backup'].ports,undefined);
  assert.equal(compose.services['postgres-backup'].environment.TZ,'UTC');
  assert.match(await readFile('Dockerfile','utf8'),/USER nextjs:nodejs/);
  assert.match(await readFile('deployment/compose.release.yml','utf8'),/backup-volume-init:[\s\S]*?image: \$\{BACKUP_IMAGE/);
});

test('private backup worker starts the exact request before acknowledging, rejects forged requests and prevents duplicate processes', async () => {
  const { createBackupServer } = require('../backup/control-server.cjs');
  const directory = await mkdtemp(path.join(tmpdir(), 'n360-worker-'));
  let starts = 0;
  let busy = false;
  let child: (EventEmitter & { exitCode: number | null; signalCode: string | null; kill: () => void }) | undefined;
  const server = createBackupServer({ secret: 'synthetic-worker-secret', directory, launch: (command: string, args: string[], options: { shell: boolean }) => {
    assert.equal(command, '/backup.sh');
    assert.deepEqual(args.slice(0, 1), ['--manual']);
    assert.equal(options.shell, false);
    starts++;
    const process = Object.assign(new EventEmitter(), { exitCode: null as number | null, signalCode: null as string | null, kill: () => { process.exitCode = 143; process.emit('exit', 143); } });
    child = process;
    setTimeout(() => { if (busy) { process.exitCode = 75; process.emit('exit', 75); } else void writeFile(path.join(directory, `backup-${args[1]}.started`), 'started'); }, 10);
    return process;
  } });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  const origin = `http://127.0.0.1:${address.port}`;
  const request = (id: string, authorized = true) => fetch(origin + '/start', { method: 'POST', headers: { 'Content-Type': 'application/json', ...(authorized ? { Authorization: 'Bearer synthetic-worker-secret' } : {}) }, body: JSON.stringify({ runId: id }) });
  try {
    assert.equal((await fetch(origin + '/health')).status, 200);
    assert.equal((await request('manual-fixture', false)).status, 401);
    assert.equal((await request('../unsafe')).status, 400);
    assert.equal(starts, 0);
    const response = await request('manual-fixture');
    assert.equal(response.status, 202);
    assert.deepEqual(await response.json(), { started: true, runId: 'manual-fixture' });
    await access(path.join(directory, 'backup-manual-fixture.started'));
    assert.equal((await request('manual-fixture')).status, 202);
    assert.equal(starts, 1);
    assert.equal((await request('another-run')).status, 409);
    child!.kill();
    busy = true;
    assert.equal((await request('busy-run')).status, 409);
  } finally {
    await new Promise<void>(resolve => { server.close(resolve); server.closeAllConnections(); });
    await rm(directory, { recursive: true, force: true });
  }
});

test('native worker immediately creates a real PostgreSQL 16 dump without a terminal poll', { skip: !process.env.BACKUP_TEST_DOCKER_IMAGE }, async () => {
  const image = process.env.BACKUP_TEST_DOCKER_IMAGE!;
  const prefix = 'n360-backup-native-' + randomBytes(4).toString('hex');
  const names = { database: prefix + '-pg', app: prefix + '-app', worker: prefix + '-worker', volume: prefix + '-volume', network: prefix + '-network' };
  const directory = await mkdtemp(path.join(tmpdir(), prefix));
  const docker = (...args: string[]) => execFileSync('docker', args, { encoding: 'utf8', timeout: 60_000, stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  const pause = () => new Promise(resolve => setTimeout(resolve, 300));
  const label = 'nisaab360.test=' + prefix;
  try {
    docker('network', 'create', '--label', label, names.network);
    docker('volume', 'create', '--label', label, names.volume);
    docker('run', '--rm', '--network', 'none', '-v', names.volume + ':/backups', image, '--init-volume');
    docker('run', '-d', '--name', names.database, '--label', label, '--network', names.network, '--network-alias', 'postgres', '--tmpfs', '/var/lib/postgresql/data', '-e', 'POSTGRES_USER=app', '-e', 'POSTGRES_DB=app', '-e', 'POSTGRES_PASSWORD=disposable-native-fixture-password', 'postgres:16-alpine');
    let ready = false;
    for (let attempt = 0; attempt < 40; attempt++) {
      try { docker('exec', names.database, 'pg_isready', '-h', '127.0.0.1', '-U', 'app', '-d', 'app'); ready = true; break; } catch { await pause(); }
    }
    assert.ok(ready, 'Disposable PostgreSQL must become ready');
    docker('exec', names.database, 'psql', '-U', 'app', '-d', 'app', '-v', 'ON_ERROR_STOP=1', '-c', 'CREATE TABLE fixture_values(id integer PRIMARY KEY); INSERT INTO fixture_values VALUES(42);');
    const fixture = path.join(directory, 'app-fixture.cjs');
    await writeFile(fixture, `const http=require('node:http'),fs=require('node:fs'),crypto=require('node:crypto'),cp=require('node:child_process');let claimed=false,uploaded=false,finished=false;http.createServer(async(req,res)=>{const reply=(s,b)=>{res.writeHead(s,{'Content-Type':'application/json'});res.end(JSON.stringify(b))};if(req.url==='/result')return reply(200,{claimed,uploaded,finished});if(req.headers.authorization!=='Bearer synthetic-native-cron-secret')return reply(401,{});let text='';for await(const part of req)text+=part;const body=JSON.parse(text);if(req.url.endsWith('/control')){if(body.action==='retry-email')return reply(200,{delivered:0});if(body.action==='claim'){if(body.runId!=='manual-native-check'||claimed)return reply(200,{job:null});claimed=true;return reply(200,{job:{runId:body.runId,fileName:'database-2026-10-30-21-00-1234567890abcdef.dump'}})}if(body.action==='finish'){finished=body.success===true;return reply(200,{success:true})}}if(req.url==='/api/cron/central-backup'){try{const stat=fs.statSync(body.filePath),data=fs.readFileSync(body.filePath),catalog=cp.execFileSync('pg_restore',['--list',body.filePath],{encoding:'utf8'});if(stat.uid!==1001||(stat.mode&63)!==0||data.length!==body.fileSizeBytes||crypto.createHash('sha256').update(data).digest('hex')!==body.sha256||!catalog.includes('fixture_values'))throw Error('Invalid native dump');uploaded=true;return reply(200,{success:true})}catch{return reply(500,{error:'Native dump validation failed'})}}reply(400,{})}).listen(3000,'0.0.0.0');`);
    docker('create', '--name', names.app, '--label', label, '--network', names.network, '--network-alias', 'app', '--user', '1001:1001', '--tmpfs', '/var/lib/postgresql/data', '-v', names.volume + ':/backups', '--entrypoint', 'node', image, '/tmp/app-fixture.cjs');
    docker('cp', fixture, names.app + ':/tmp/app-fixture.cjs');
    docker('start', names.app);
    docker('run', '-d', '--init', '--name', names.worker, '--label', label, '--network', names.network, '--network-alias', 'worker', '--tmpfs', '/var/lib/postgresql/data', '--cap-drop', 'ALL', '--cap-add', 'SETUID', '--cap-add', 'SETGID', '--security-opt', 'no-new-privileges:true', '-v', names.volume + ':/backups', '-e', 'CRON_SECRET=synthetic-native-cron-secret', '-e', 'POSTGRES_HOST=postgres', '-e', 'POSTGRES_DATABASE=app', '-e', 'POSTGRES_USER=app', '-e', 'POSTGRES_PASSWORD=disposable-native-fixture-password', image);
    ready = false;
    for (let attempt = 0; attempt < 30; attempt++) {
      try { docker('exec', '--user', '1001:1001', names.worker, '/healthcheck.sh'); ready = true; break; } catch { await pause(); }
    }
    assert.ok(ready, 'Worker listener and private volume must be ready');
    const probe = `const assert=require('node:assert/strict');(async()=>{const before=Date.now();const denied=await fetch('http://worker:8788/start',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({runId:'manual-native-check'})});assert.equal(denied.status,401);const response=await fetch('http://worker:8788/start',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer synthetic-native-cron-secret'},body:JSON.stringify({runId:'manual-native-check'})});assert.equal(response.status,202,await response.text());assert.ok(Date.now()-before<15000);let result;for(let n=0;n<50;n++){result=await(await fetch('http://app:3000/result')).json();if(result.finished)break;await new Promise(r=>setTimeout(r,100))}assert.deepEqual(result,{claimed:true,uploaded:true,finished:true});const rejected=await fetch('http://worker:8788/start',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer synthetic-native-cron-secret'},body:JSON.stringify({runId:'unclaimable-run'})});assert.equal(rejected.status,503);console.log('PASS real PostgreSQL dump: direct start, UID 1001, private file permissions, catalog/hash verification, completion, and rejected invalid start.')})().catch(e=>{console.error(e);process.exitCode=1});`;
    const output = docker('exec', names.worker, 'node', '-e', probe);
    assert.match(output, /PASS real PostgreSQL dump/);
  } catch (error) {
    for (const name of [names.worker, names.app]) try { console.error(docker('logs', '--tail', '20', name)); } catch {}
    throw error;
  } finally {
    for (const name of [names.worker, names.app, names.database]) {
      try { if (docker('inspect', '--format', '{{index .Config.Labels "nisaab360.test"}}', name) === prefix) docker('rm', '-f', '-v', name); } catch {}
    }
    for (const [kind, name] of [['volume', names.volume], ['network', names.network]]) {
      try { if (docker(kind, 'inspect', '--format', '{{index .Labels "nisaab360.test"}}', name) === prefix) docker(kind, 'rm', name); } catch {}
    }
    assert.ok(path.resolve(directory).startsWith(path.resolve(tmpdir()) + path.sep));
    await rm(directory, { recursive: true, force: true });
  }
});

async function isolatedModule<T>(entry: string, mocks: Record<string,string>): Promise<T> {
  const result=await build({entryPoints:[entry],bundle:true,write:false,platform:'node',format:'cjs',packages:'external',logLevel:'silent',plugins:[{name:'backup-fixtures',setup(b){
    b.onResolve({filter:/.*/},args=>{if(args.path==='./central-backup-config'&&!mocks[args.path])return {path:'central-config-empty',namespace:'fixture'};return mocks[args.path]?{path:args.path,namespace:'fixture'}:undefined;});
    b.onLoad({filter:/.*/,namespace:'fixture'},args=>({contents:args.path==='central-config-empty'?'export const getStoredCentralDriveCredentials=async()=>null;':mocks[args.path],loader:'js'}));
  }}]});
  const loaded={exports:{} as T};new Function('require','module','exports',result.outputFiles[0].text)(require,loaded,loaded.exports);return loaded.exports;
}

test('Drive OAuth callback uses the configured public origin behind a proxy on success, denial and replay', async () => {
  const previousFetch = globalThis.fetch;
  const names = ['GOOGLE_DRIVE_CENTRAL_CLIENT_ID', 'GOOGLE_DRIVE_CENTRAL_CLIENT_SECRET', 'GOOGLE_DRIVE_CENTRAL_REDIRECT_URI'] as const;
  const previousEnvironment = names.map(name => process.env[name]);
  const fixture = {
    secret: new TextEncoder().encode('synthetic-oauth-signing-key-at-least-32-characters'),
    pending: true,
    providerFailure: false,
    requests: 0,
    saved: [] as unknown[],
    async query(sql: string, values: unknown[]) {
      if (sql.includes('oauth_state_hash=NULL')) {
        const rowCount = this.pending ? 1 : 0;
        this.pending = false;
        return { rowCount, rows: rowCount ? [{ id: 1 }] : [] };
      }
      assert.match(sql, /drive_credentials_encrypted/);
      this.saved = values;
      return { rowCount: 1, rows: [] };
    },
  };
  const globals = globalThis as typeof globalThis & { __driveRedirectFixture?: typeof fixture };
  globals.__driveRedirectFixture = fixture;
  process.env.GOOGLE_DRIVE_CENTRAL_CLIENT_ID = 'synthetic-client';
  process.env.GOOGLE_DRIVE_CENTRAL_CLIENT_SECRET = 'synthetic-client-secret';
  process.env.GOOGLE_DRIVE_CENTRAL_REDIRECT_URI = 'https://sa.example.test/api/sa/central-backup/google-drive/callback';
  globalThis.fetch = async (input, options) => {
    fixture.requests++;
    const url = new URL(String(input));
    if (url.origin === 'https://oauth2.googleapis.com') {
      if (fixture.providerFailure) return Response.json({}, { status: 502 });
      const grant = new URLSearchParams(String(options?.body)).get('grant_type');
      return Response.json(grant === 'authorization_code' ? { refresh_token: 'private-refresh-token' } : { access_token: 'private-access-token' });
    }
    assert.equal(url.origin, 'https://www.googleapis.com');
    return Response.json(url.pathname.endsWith('/about')
      ? { user: { emailAddress: 'synthetic@example.test' } }
      : { files: [{ id: 'synthetic-folder' }] });
  };
  try {
    const { GET } = await isolatedModule<{ GET: (req: NextRequest) => Promise<Response> }>(
      'src/app/api/sa/central-backup/google-drive/callback/route.ts', {
        '@/db': 'export const pool={query:(...args)=>globalThis.__driveRedirectFixture.query(...args)};',
        '@/lib/rbac': 'export const requireRole=(_roles,handler)=>req=>handler(req,{session:{userId:1,planDeviceSessionId:"synthetic-device"}});',
        '@/lib/jwt-secret': 'export const getJwtSecret=()=>globalThis.__driveRedirectFixture.secret;',
        '@/lib/central-backup-config': 'export const secretHash=()=>"synthetic-state-hash";export const encryptStreamingCredentials=()=>"encrypted-token";',
      },
    );
    const state = await new SignJWT({ purpose: 'central-google-drive-setup', nonce: 'synthetic-nonce', device: 'synthetic-device' })
      .setProtectedHeader({ alg: 'HS256' }).setSubject('1').setExpirationTime('15m').sign(fixture.secret);
    const request = (query: string) => new NextRequest(`http://0.0.0.0:3000/api/sa/central-backup/google-drive/callback?${query}`, {
      headers: { host: 'untrusted.example', 'x-forwarded-host': 'untrusted.example', 'x-forwarded-proto': 'http' },
    });
    const assertRedirect = (response: Response, expected: string) => {
      assert.equal(response.status, 307);
      assert.equal(response.headers.get('location'), expected);
      assert.equal(response.headers.get('cache-control'), 'no-store');
      assert.equal(response.headers.get('referrer-policy'), 'no-referrer');
    };
    const query = new URLSearchParams({ code: 'private-auth-code', state }).toString();
    assertRedirect(await GET(request(query)), 'https://sa.example.test/sa/backups?drive=connected');
    assert.deepEqual(fixture.saved, ['encrypted-token', 'synthetic-folder', 'synthetic@example.test']);
    assert.equal(fixture.requests, 4);
    assertRedirect(await GET(request(query)), 'https://sa.example.test/sa/backups?drive=failed');
    assertRedirect(await GET(request('error=access_denied')), 'https://sa.example.test/sa/backups?drive=failed');
    assertRedirect(await GET(request('code=private-auth-code&state=invalid')), 'https://sa.example.test/sa/backups?drive=failed');
    assert.equal(fixture.requests, 4, 'Replay, denial and invalid state must not contact Google');
    fixture.pending = true;
    fixture.providerFailure = true;
    assertRedirect(await GET(request(query)), 'https://sa.example.test/sa/backups?drive=failed');
    assert.equal(fixture.requests, 5);
    process.env.GOOGLE_DRIVE_CENTRAL_REDIRECT_URI = 'http://localhost:3000/api/sa/central-backup/google-drive/callback';
    assertRedirect(await GET(request('error=access_denied')), 'http://localhost:3000/sa/backups?drive=failed');
  } finally {
    globalThis.fetch = previousFetch;
    names.forEach((name, index) => {
      if (previousEnvironment[index] === undefined) delete process.env[name];
      else process.env[name] = previousEnvironment[index];
    });
    delete globals.__driveRedirectFixture;
  }
});

test('central endpoint: auth, missing IDs, checksum, database failure, retry, idempotency and replica exclusion', async () => {
  const memory=await PGlite.create();const dir=await mkdtemp(path.join(tmpdir(),'n360-endpoint-'));
  let failCompletion=false;
  const state={client:{query:async(sql:string,params?:unknown[])=>{
    if(failCompletion&&sql.startsWith("UPDATE central_database_backups SET status='COMPLETED'")) {failCompletion=false;throw Object.assign(Error('fixture database failure'),{code:'08006'});}
    return memory.query(sql,params);
  }},locked:false,dbFail:false,uploadFail:false,uploads:0,
    remote:new Map<string,{size:number;hash:string}>(),realPath:path.join(dir,'raw.dump'),encryptedPath:path.join(dir,'raw.dump.enc'),
    encrypt:encryptCentralDump,hash:backupFileSha256};
  (globalThis as typeof globalThis & {__backupFixture?:typeof state}).__backupFixture=state;
  const mocks={
    '@/lib/auth':`export const timingSafeEqual=(a,b)=>a===b;`,
    '@/lib/central-backup-config':`export const getBackupSettings=async()=>({enabled:true,drive_credentials_encrypted:'fixture',drive_folder_id:'fixture-folder',recovery_email:'recovery@example.test',recovery_email_verified_at:new Date()});export const backupReady=()=>true;export const encryptStreamingCredentials=()=> 'encrypted-password';`,
    '@/lib/database-recovery-package':`export const createRecoveryPackage=async()=>({});`,
    '@/lib/central-backup-delivery':`export async function deliverBackupPassword(client,runId){await client.query("UPDATE central_database_backups SET status='COMPLETED',password_sent_at=now() WHERE run_id=$1",[runId]);}export const retainLatestDatabaseBackups=async()=>{};`,
    '@/lib/streaming-credentials':`export const decryptStreamingCredentials=()=>({password:'fixture-backup-password'});`,
    '@/lib/central-backup-lock':`export class BackupBusyError extends Error{};export async function withCentralBackupLock(work){const s=globalThis.__backupFixture;if(s.locked)throw new BackupBusyError();if(s.dbFail)throw Object.assign(Error('SECRET must not leak'),{code:'42703'});s.locked=true;try{return await work(s.client,new AbortController().signal)}finally{s.locked=false}}`,
    'node:fs/promises':`export * from 'fs/promises';import * as fs from 'fs/promises';const mapped=p=>p.endsWith('.enc')?globalThis.__backupFixture.encryptedPath:p.endsWith('.package')?globalThis.__backupFixture.realPath+'.package':globalThis.__backupFixture.realPath;export const lstat=p=>fs.lstat(mapped(p));export const realpath=async p=>p;export const unlink=p=>fs.unlink(mapped(p));`,
    '@/lib/central-backup-crypto':`export const generateBackupPassword=()=> 'synthetic-random-password';export const backupFileSha256=p=>globalThis.__backupFixture.hash(p.endsWith('.enc')?globalThis.__backupFixture.encryptedPath:globalThis.__backupFixture.realPath);export const encryptCentralDump=(_i,_o,password,signal)=>globalThis.__backupFixture.encrypt(globalThis.__backupFixture.realPath,globalThis.__backupFixture.encryptedPath,password,signal);`,
    '@/lib/central-drive-backups':`export const centralDriveFolderId=()=> 'fixture-folder';export const reserveCentralDriveFileId=async()=> 'reserved-id';export const applyCentralDriveRetention=async()=>({kept:1,deleted:0,errors:0});export async function verifyCentralDriveFile(o){const r=globalThis.__backupFixture.remote.get(o.driveFileId);if(!r)throw Object.assign(Error('not found'),{status:404});return r.size===o.expectedSize&&r.hash===o.expectedSha256}export async function uploadCentralBackupFile(o){const s=globalThis.__backupFixture;s.uploads++;if(s.uploadFail)throw Error('SECRET provider message');const fs=await import('fs/promises');const crypto=await import('crypto');const data=await fs.readFile(s.encryptedPath);s.remote.set(o.driveFileId,{size:data.length,hash:crypto.createHash('sha256').update(data).digest('hex')});return {driveFileId:o.driveFileId,size:data.length};}`,
  };
  try {
    await memory.exec(await readFile('drizzle/0060_central_database_backups.sql','utf8'));
    await memory.exec("CREATE TABLE central_backup_settings(id integer PRIMARY KEY,database_password_encrypted text);INSERT INTO central_backup_settings VALUES(1,'fixture')");
    const {POST}=await isolatedModule<{POST:(r:NextRequest)=>Promise<Response>}>('src/app/api/cron/central-backup/route.ts',mocks);
    process.env.CRON_SECRET='isolated-backup-cron-secret';
    delete process.env.B2_REGION;delete process.env.B2_APPLICATION_KEY_ID;delete process.env.B2_APPLICATION_KEY;delete process.env.B2_BUCKET_NAME;
    const raw=Buffer.from('fixture PostgreSQL dump bytes');await writeFile(state.realPath,raw);
    const body={runId:'fixture-run',fileName:'database-2026-10-27-00-00.dump',filePath:'/backups/backup-fixture.dump',fileSizeBytes:raw.length,sha256:await backupFileSha256(state.realPath)};
    const call=(data:unknown=body,auth=true)=>POST(new NextRequest('http://fixture/api/cron/central-backup',{method:'POST',headers:{'Content-Type':'application/json',...(auth?{Authorization:`Bearer ${process.env.CRON_SECRET}`}:{})},body:JSON.stringify(data)}));
    assert.equal((await call(body,false)).status,401);assert.equal((await call({...body,runId:undefined})).status,400);
    assert.equal((await call({...body,filePath:'/backups/../secret'})).status,400);
    assert.equal((await call()).status,500,'Legacy missing columns must produce a controlled database failure');
    await memory.exec(await readFile(`drizzle/${repairName}`,'utf8'));
    await memory.exec('CREATE TABLE super_admins(id integer PRIMARY KEY)');
    await memory.exec(await readFile('drizzle/0087_database_backup_recovery.sql','utf8'));
    assert.equal((await call({...body,sha256:'0'.repeat(64)})).status,400);
    state.dbFail=true;const dbFailure=await call();assert.equal(dbFailure.status,500);assert.ok(!(await dbFailure.text()).includes('SECRET'));state.dbFail=false;
    state.locked=true;assert.equal((await call()).status,409);state.locked=false;
    state.uploadFail=true;const failed=await call();assert.equal(failed.status,500);assert.ok(!(await failed.text()).includes('SECRET'));
    assert.equal((await memory.query<{status:string}>('SELECT status FROM central_database_backups')).rows[0].status,'FAILED');
    await access(state.encryptedPath);await access(state.realPath);
    const originalCiphertextHash=await backupFileSha256(state.encryptedPath);
    state.uploadFail=false;failCompletion=true;assert.equal((await call()).status,500);
    assert.equal(await backupFileSha256(state.encryptedPath),originalCiphertextHash,'retry must preserve identical ciphertext for a reserved Drive ID');
    assert.equal((await call()).status,200);assert.equal(state.uploads,2,'ambiguous upload completion must recover without uploading again');
    const done=await call();assert.equal(done.status,200);assert.equal((await done.json()).idempotent,true);assert.equal(state.uploads,2);
    assert.equal((await call({...body,sha256:'1'.repeat(64)})).status,409);
    // Simulate a crash after Drive accepted bytes but before the DB completion.
    await memory.exec("UPDATE central_database_backups SET status='UPLOADING'");
    assert.equal((await call()).status,200);assert.equal(state.uploads,2,'recovery must reuse verified remote artifact');
  } finally {await memory.close();await rm(dir,{recursive:true,force:true});delete (globalThis as {__backupFixture?:unknown}).__backupFixture;}
});

test('readiness fails closed on missing backup columns and retains cache-degraded semantics', async () => {
  const state={schemaMissing:false,redisReady:true};(globalThis as {__backupReadiness?:typeof state}).__backupReadiness=state;
  try {
    const {GET}=await isolatedModule<{GET:()=>Promise<Response>}>('src/app/api/ready/route.ts',{
      '@/db':`export const readinessPool={query:async q=>{if(q.includes('central_database_backups')&&globalThis.__backupReadiness.schemaMissing)throw Error('42703')}};`,
      '@/lib/redis':`export const redis={get status(){return globalThis.__backupReadiness.redisReady?'ready':'closed'},ping:async()=> 'PONG'};`,
      '@/lib/api-policy':'export const withApiPolicy=fn=>fn;', '@/lib/cors':'export const corsPreflight=()=>new Response();',
    });
    assert.equal((await GET()).status,200);state.schemaMissing=true;assert.equal((await GET()).status,503);
    state.schemaMissing=false;state.redisReady=false;assert.equal((await (await GET()).json()).status,'degraded');
  } finally {delete (globalThis as {__backupReadiness?:unknown}).__backupReadiness;}
});

test('Drive transport: preallocated IDs, checksum/parent verification, pagination and conservative retention', async () => {
  const originalFetch=globalThis.fetch;const deleted:string[]=[];const dir=await mkdtemp(path.join(tmpdir(),'n360-drive-'));
  const file=(id:string,name:string)=>({id,name,size:'99',createdTime:'2026-10-27T00:00:00Z'});
  const files=[file('today','database-2026-10-27-12-00-0123456789abcdef.dump.enc'),file('today-early','database-2026-10-27-00-00.dump.enc'),
    file('yesterday','database-2026-10-26-00-00.dump.enc'),file('september','database-2026-09-01-00-00.dump.enc'),
    file('august','database-2026-08-01-00-00.dump.enc'),file('july','database-2026-07-01-00-00.dump.enc'),
    file('untracked','database-2025-01-01-00-00.dump.enc'),file('invalid','database-2026-02-31-00-00.dump.enc'),file('other','notes.txt')];
  let failPage=false;let uploadedId='';const checksum='a'.repeat(64);
  process.env.GOOGLE_DRIVE_CENTRAL_CLIENT_ID='fixture';process.env.GOOGLE_DRIVE_CENTRAL_CLIENT_SECRET='fixture';
  process.env.GOOGLE_DRIVE_CENTRAL_REDIRECT_URI='https://example.test/callback';process.env.GOOGLE_DRIVE_CENTRAL_REFRESH_TOKEN='fixture';
  globalThis.fetch=async(input,init)=>{
    const url=new URL(String(input));
    if(url.hostname==='oauth2.googleapis.com')return Response.json({access_token:'fixture-access'});
    if(url.pathname.endsWith('/generateIds'))return Response.json({ids:['allocated-id']});
    if(init?.method==='DELETE'){deleted.push(url.pathname.split('/').at(-1)!);return new Response(null,{status:204});}
    if(url.hostname==='www.googleapis.com'&&url.pathname==='/upload/drive/v3/files'){
      uploadedId=JSON.parse(String(init?.body)).id;return new Response(null,{status:200,headers:{Location:'https://fixture-upload.test/session'}});
    }
    if(url.hostname==='fixture-upload.test'){
      for await (const _chunk of init?.body as unknown as AsyncIterable<Buffer>) {void _chunk;}
      return Response.json({id:uploadedId,size:99});
    }
    if(url.pathname.endsWith('/files/allocated-id'))return Response.json({id:'allocated-id',size:'99',sha256Checksum:checksum,parents:['folder']});
    if(url.pathname.endsWith('/files')){
      if(url.searchParams.get('pageToken')){if(failPage)return Response.json({error:'SECRET'},{status:503});return Response.json({files:files.slice(4)});}
      return Response.json({files:files.slice(0,4),nextPageToken:'next'});
    }
    throw Error(`Unexpected mocked request ${url.pathname}`);
  };
  try {
    const drive=await isolatedModule<typeof import('../src/lib/central-drive-backups')>('src/lib/central-drive-backups.ts',{});
    assert.equal(await drive.reserveCentralDriveFileId(),'allocated-id');
    const fixture=path.join(dir,'encrypted');await writeFile(fixture,Buffer.alloc(99));
    await drive.uploadCentralBackupFile({filePath:fixture,fileName:'database-fixture.dump.enc',folderId:'folder',driveFileId:'allocated-id'});
    assert.equal(uploadedId,'allocated-id');
    assert.equal(await drive.verifyCentralDriveFile({driveFileId:'allocated-id',expectedSize:99,expectedSha256:checksum,folderId:'folder'}),true);
    assert.equal(await drive.verifyCentralDriveFile({driveFileId:'allocated-id',expectedSize:99,expectedSha256:'b'.repeat(64)}),false);
    assert.equal(await drive.verifyCentralDriveFile({driveFileId:'allocated-id',expectedSize:98}),false);
    assert.equal(await drive.verifyCentralDriveFile({driveFileId:'allocated-id',expectedSize:99,folderId:'other'}),false);
    assert.equal((await drive.listCentralDriveFiles('folder')).length,9);
    const verified=new Set(['today','today-early','yesterday','september','august','july','invalid','other']);
    const result=await drive.applyCentralDriveRetention('folder',2,2,verified);
    assert.deepEqual(deleted.sort(),['august','july']);assert.deepEqual(result,{kept:4,deleted:2,errors:0});
    deleted.length=0;failPage=true;await assert.rejects(()=>drive.applyCentralDriveRetention('folder',2,2,verified));assert.equal(deleted.length,0);
    const cancelled=new AbortController();cancelled.abort();
    await assert.rejects(()=>drive.applyCentralDriveRetention('folder',2,2,verified,cancelled.signal));assert.equal(deleted.length,0);
  } finally {globalThis.fetch=originalFetch;await rm(dir,{recursive:true,force:true});}
});

test('session advisory lock bypasses PgBouncer, excludes a second replica, releases on failure and aborts on connection loss',async()=>{
  let locked=false;let releases=0;let ends=0;
  class Client extends EventEmitter {
    async query(sql:string){if(sql.includes('pg_try_advisory_lock')){if(locked)return {rows:[{locked:false}]};locked=true;return {rows:[{locked:true}]};}locked=false;return {rows:[]};}
    release(){releases++;}
  }
  const state={Pool:class {async connect(){return new Client();}async end(){ends++;}}};
  (globalThis as {__backupLock?:typeof state}).__backupLock=state;
  try {
    const service=await isolatedModule<typeof import('../src/lib/central-backup-lock')>('src/lib/central-backup-lock.ts',{
      pg:'export const Pool=globalThis.__backupLock.Pool;',
    });
    process.env.DIRECT_URL='postgres://fixture:fixture@localhost:5432/fixture';
    let proceed!:()=>void;let entered!:()=>void;const ready=new Promise<void>(resolve=>{entered=resolve;});
    const first=service.withCentralBackupLock(async()=>{entered();await new Promise<void>(resolve=>{proceed=resolve;});return 'done';});
    await ready;await assert.rejects(()=>service.withCentralBackupLock(async()=> 'unexpected'),service.BackupBusyError);
    proceed();assert.equal(await first,'done');assert.equal(locked,false);
    await assert.rejects(()=>service.withCentralBackupLock(async()=>{throw Error('fixture failure');}));assert.equal(locked,false);
    await service.withCentralBackupLock(async(client,signal)=>{client.emit('error',Error('lost'));assert.equal(signal.aborted,true);locked=false;});
    process.env.DIRECT_URL='postgres://fixture:fixture@localhost:6432/fixture';await assert.rejects(()=>service.withCentralBackupLock(async()=>{}));
    assert.equal(releases,4);assert.equal(ends,4);
  } finally {delete (globalThis as {__backupLock?:unknown}).__backupLock;delete process.env.DIRECT_URL;}
});

test('offline recovery streams downloads, authenticates before catalog checks and never overwrites existing output',async()=>{
  const originalFetch=globalThis.fetch;const dir=await mkdtemp(path.join(tmpdir(),'n360-recovery-test-'));
  let catalogFailure=false;let catalogCalls=0;
  const state={execFileSync:(command:string,args:string[])=>{assert.equal(command,'pg_restore');assert.equal(args[0],'--list');catalogCalls++;if(catalogFailure)throw Error('invalid dump');}};
  (globalThis as {__backupRecovery?:typeof state}).__backupRecovery=state;
  try {
    const source=path.join(dir,'source');const encrypted=path.join(dir,'source.enc');const password='fourteen-chars!';
    const content=Buffer.from('isolated dump fixture');await writeFile(source,content);await encryptCentralDump(source,encrypted,password);
    const bytes=await readFile(encrypted);const hash=await backupFileSha256(encrypted);
    globalThis.fetch=async input=>String(input).includes('alt=media')?new Response(bytes):Response.json({id:'fixture-id',name:'database.dump.enc',size:String(bytes.length),sha256Checksum:hash});
    const service=await isolatedModule<typeof import('./restore-central-drive-backup')>('scripts/restore-central-drive-backup.ts',{
      'dotenv/config':'export {};',
      '../src/lib/central-drive-backups':"export const getCentralAccessToken=async()=> 'fixture';",
      'node:child_process':'export const execFileSync=(...args)=>globalThis.__backupRecovery.execFileSync(...args);',
    });
    const output=path.join(dir,'restored.dump');await service.prepareCentralRestore('fixture-id',output,password);
    assert.deepEqual(await readFile(output),content);assert.equal(catalogCalls,1);
    await assert.rejects(()=>service.prepareCentralRestore('fixture-id',output,password));assert.deepEqual(await readFile(output),content);
    await assert.rejects(()=>service.prepareCentralRestore('fixture-id',path.join(dir,'wrong.dump'),'wrong-password!'));assert.equal(catalogCalls,1);
    await assert.rejects(()=>access(path.join(dir,'wrong.dump')));
    catalogFailure=true;await assert.rejects(()=>service.prepareCentralRestore('fixture-id',path.join(dir,'invalid.dump'),password));
    await assert.rejects(()=>access(path.join(dir,'invalid.dump')));
    const {readdir}=await import('node:fs/promises');assert.ok(!(await readdir(dir)).some(name=>name.startsWith('.n360-recovery-')));
  } finally {globalThis.fetch=originalFetch;delete (globalThis as {__backupRecovery?:unknown}).__backupRecovery;await rm(dir,{recursive:true,force:true});}
});

test('optional PostgreSQL 16 CI schema verification uses only a loopback test service', {skip:!process.env.BACKUP_TEST_DATABASE_URL},async()=>{
  const url=new URL(process.env.BACKUP_TEST_DATABASE_URL!);
  assert.ok(['127.0.0.1','localhost','[::1]'].includes(url.hostname));
  const {Pool}=await import('pg');const pool=new Pool({connectionString:url.toString(),max:1});
  try {await verifySchema((sql,params)=>pool.query(sql,params));} finally {await pool.end();}
});
