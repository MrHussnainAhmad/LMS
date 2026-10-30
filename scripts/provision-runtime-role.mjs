// Operator-only, never called at application startup. No .env is loaded implicitly.
import pg from 'pg';
const apply = process.argv.includes('--apply');
const role = process.env.DATABASE_RUNTIME_USER || 'nisaab_runtime';
const password = process.env.DATABASE_RUNTIME_PASSWORD;
if (!/^[a-z_][a-z0-9_]{2,62}$/.test(role) || !password || !/^[a-f0-9]{64,128}$/i.test(password)) throw new Error('Set a distinct runtime role and a random 32+ byte hex password');
if (!apply) { console.log('Dry run: would create/restrict the runtime role and grant DML, sequences and temporary tables. Use --apply with operator DIRECT_URL after review.'); process.exit(0); }
const client = new pg.Client({ connectionString: process.env.DIRECT_URL });
const quote = value => '"' + value.replaceAll('"','""') + '"';
try {
  await client.connect(); await client.query('BEGIN');
  const { rows: [owner] } = await client.query('SELECT current_user AS name, current_database() AS database');
  if (owner.name === role) throw new Error('Runtime and provisioner roles must differ');
  const { rows: existing } = await client.query('SELECT oid FROM pg_roles WHERE rolname=$1', [role]);
  if (existing.length) {
    const { rows: [unsafe] } = await client.query(`SELECT EXISTS(SELECT 1 FROM pg_auth_members WHERE member=$1) OR EXISTS(SELECT 1 FROM pg_class WHERE relowner=$1) OR EXISTS(SELECT 1 FROM pg_database WHERE datdba=$1) OR EXISTS(SELECT 1 FROM pg_namespace WHERE nspowner=$1) AS unsafe`, [existing[0].oid]);
    if (unsafe.unsafe) throw new Error('Existing runtime role owns objects or has memberships; resolve these before provisioning');
  } else await client.query('CREATE ROLE ' + quote(role) + ' LOGIN');
  await client.query('ALTER ROLE ' + quote(role) + " LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS NOINHERIT PASSWORD '" + password + "'");
  await client.query('REVOKE CREATE ON SCHEMA public FROM PUBLIC');
  await client.query('REVOKE CREATE ON SCHEMA public FROM ' + quote(role));
  await client.query('REVOKE CREATE ON DATABASE ' + quote(owner.database) + ' FROM ' + quote(role));
  await client.query('GRANT CONNECT, TEMPORARY ON DATABASE ' + quote(owner.database) + ' TO ' + quote(role));
  await client.query('GRANT USAGE ON SCHEMA public TO ' + quote(role));
  await client.query('GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO ' + quote(role));
  await client.query('GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO ' + quote(role));
  // Run as the same role that owns future migrations so defaults cover new tables.
  await client.query('ALTER DEFAULT PRIVILEGES FOR ROLE ' + quote(owner.name) + ' IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO ' + quote(role));
  await client.query('ALTER DEFAULT PRIVILEGES FOR ROLE ' + quote(owner.name) + ' IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO ' + quote(role));
  await client.query('COMMIT'); console.log('Runtime role provisioned; no credentials printed.');
} catch { await client.query('ROLLBACK').catch(() => {}); console.error('Role provisioning failed; review the role, owner, memberships and connection configuration. No credentials printed.'); process.exitCode=1; }
finally { await client.end(); }
