/** Explicit local-only recovery, independent of the application database/login.
 * Start only on the NEW server with apps/workers stopped. Never imports .env automatically.
 */
import { createServer } from "node:http";
import { randomBytes, timingSafeEqual } from "node:crypto";
import {
  mkdtemp,
  open,
  readFile,
  writeFile,
  rm,
  mkdir,
  statfs,
  copyFile,
  chmod,
  realpath,
} from "node:fs/promises";
import { constants } from "node:fs";
import path from "node:path";
import { tmpdir } from "node:os";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { pathToFileURL } from "node:url";
import pg from "pg";
import { decryptCentralDump } from "../src/lib/central-backup-crypto";
import {
  extractRecoveryPackage,
  validateRecoveredConfiguration,
  MAX_RECOVERY_BYTES,
  type RecoveryManifest,
} from "../src/lib/database-recovery-package";
const execute = promisify(execFile);
export async function assertEmptyRecoveryTarget(
  client: Pick<pg.Client, "query">,
) {
  const {
    rows: [state],
  } = await client.query(`SELECT current_database() AS database,
 (SELECT count(*)::integer FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname NOT IN ('pg_catalog','information_schema') AND n.nspname NOT LIKE 'pg_toast%' AND n.nspname NOT LIKE 'pg_temp%') AS objects,
 (SELECT count(*)::integer FROM pg_stat_activity WHERE datname=current_database() AND pid<>pg_backend_pid()) AS connections,
 current_setting('server_version_num')::integer AS version`);
  if (
    !state ||
    state.objects !== 0 ||
    state.connections !== 0 ||
    state.version < 160000 ||
    state.version >= 170000 ||
    ["postgres", "template0", "template1"].includes(state.database)
  )
    throw Error(
      "Use an empty isolated PostgreSQL 16 database with every application/worker stopped",
    );
}
export async function finalizeRecoveredDatabase(
  client: Pick<pg.Client, "query">,
) {
  await client.query("BEGIN");
  try {
    for (const table of [
      "refresh_tokens",
      "plan_device_sessions",
      "qr_login_sessions",
      "push_devices",
    ])
      await client.query(
        `UPDATE "${table}" SET revoked_at=now() WHERE revoked_at IS NULL`,
      );
    await client.query(
      "UPDATE central_backup_settings SET enabled=false,restore_review_required=true,oauth_state_hash=NULL,oauth_state_expires_at=NULL,email_verification_hash=NULL,email_verification_expires_at=NULL,pending_recovery_email=NULL WHERE id=1",
    );
    await client.query(
      "UPDATE central_backup_jobs SET status='FAILED',completed_at=now(),error='Cancelled by full database recovery' WHERE status IN ('PENDING','RUNNING')",
    );
    await client.query(
      "UPDATE central_database_backups SET status='FAILED',error='Interrupted at backup snapshot; do not use as a completed backup' WHERE status IN ('PENDING','UPLOADING')",
    );
    await client.query(
      "UPDATE email_outbox SET status='FAILED',last_error='Paused after database recovery',locked_at=NULL WHERE status IN ('PENDING','PROCESSING')",
    );
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  }
}
export function postgresEnvironment(url: URL) {
  if (
    !["postgres:", "postgresql:"].includes(url.protocol) ||
    !url.pathname.slice(1) ||
    url.port === "6432" ||
    url.searchParams.has("pgbouncer")
  )
    throw Error("Recovery requires a direct PostgreSQL connection");
  if (url.searchParams.size)
    throw Error(
      "Use PGSSLMODE/PGSSLROOTCERT environment settings instead of URL options",
    );
  return {
    ...process.env,
    PGHOST: url.hostname,
    PGPORT: url.port || "5432",
    PGDATABASE: decodeURIComponent(url.pathname.slice(1)),
    PGUSER: decodeURIComponent(url.username),
    PGPASSWORD: decodeURIComponent(url.password),
  };
}
export async function runDatabaseRecoveryServer() {
  const target = process.env.RECOVERY_DATABASE_URL;
  const outputValue = process.env.RECOVERY_OUTPUT_DIRECTORY;
  if (!target || !outputValue || !path.isAbsolute(outputValue))
    throw Error(
      "Set RECOVERY_DATABASE_URL for a NEW empty PostgreSQL 16 database and an unused absolute RECOVERY_OUTPUT_DIRECTORY",
    );
  const output = path.resolve(outputValue);
  const actualParent = await realpath(path.dirname(output));
  if (
    actualParent
      .split(/[\\/]/)
      .some((segment) =>
        ["public", "wwwroot", "htdocs", "httpdocs"].includes(
          segment.toLowerCase(),
        ),
      )
  )
    throw Error("Recovery output must be outside served directories");
  const env = postgresEnvironment(new URL(target));
  const port = Number(process.env.RECOVERY_PORT || 34871);
  if (!Number.isInteger(port) || port < 1024 || port > 65535)
    throw Error("Invalid recovery port");
  const token =
    process.env.DATABASE_RECOVERY_TOKEN ||
    randomBytes(32).toString("base64url");
  if (token.length < 32) throw Error("Recovery access token is too short");
  const work = await mkdtemp(path.join(tmpdir(), "n360-database-recovery-"));
  const removeOwned = async (targetPath: string) => {
    const resolved = path.resolve(targetPath),
      root = path.resolve(work);
    if (
      !path.basename(root).startsWith("n360-database-recovery-") ||
      (resolved !== root && !resolved.startsWith(root + path.sep))
    )
      throw Error("Unsafe recovery cleanup target");
    await rm(resolved, { recursive: true, force: true });
  };
  const nonce = randomBytes(18).toString("base64");
  let busy = false,
    restored = false,
    stage: string | null = null,
    manifest: RecoveryManifest | null = null;
  const html = page(nonce);
  const server = createServer(async (req, res) => {
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Referrer-Policy", "no-referrer");
    res.setHeader(
      "Content-Security-Policy",
      `default-src 'none'; script-src 'nonce-${nonce}'; style-src 'unsafe-inline'; connect-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'`,
    );
    const json = (status: number, data: unknown) => {
      res.writeHead(status, { "Content-Type": "application/json" });
      res.end(JSON.stringify(data));
    };
    if (
      ![`127.0.0.1:${port}`, `localhost:${port}`].includes(
        req.headers.host || "",
      )
    ) {
      json(403, { error: "Invalid host" });
      return;
    }
    if (req.method === "GET" && req.url === "/") {
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      res.end(html);
      return;
    }
    const supplied = req.headers["x-recovery-token"];
    const expected = Buffer.from(token);
    const received = Buffer.from(typeof supplied === "string" ? supplied : "");
    const origin = req.headers.origin;
    if (
      req.method !== "POST" ||
      origin !== `http://${req.headers.host}` ||
      received.length !== expected.length ||
      !timingSafeEqual(received, expected)
    ) {
      json(403, { error: "Unauthorized local recovery request" });
      return;
    }
    if (busy || restored) {
      json(409, { error: "Recovery is busy or already completed" });
      return;
    }
    busy = true;
    try {
      if (req.url === "/upload") {
        const password = req.headers["x-backup-password"];
        if (
          typeof password !== "string" ||
          password.length < 14 ||
          password.length > 200
        )
          throw Error("Invalid backup password");
        const size = Number(req.headers["content-length"]);
        if (
          !Number.isSafeInteger(size) ||
          size < 52 ||
          size > MAX_RECOVERY_BYTES
        )
          throw Error("Invalid upload size");
        const disk = await statfs(work);
        if (Number(disk.bavail) * Number(disk.bsize) < size * 3 + 1024 ** 3)
          throw Error("Insufficient disk space");
        if (stage) {
          await removeOwned(stage);
          stage = null;
          manifest = null;
        }
        const encrypted = path.join(work, "upload.enc"),
          plain = path.join(work, "package.bin");
        await rm(encrypted, { force: true });
        await rm(plain, { force: true });
        const file = await open(encrypted, "wx", 0o600);
        let total = 0;
        try {
          for await (const chunk of req) {
            total += chunk.length;
            if (total > size) throw Error("Upload exceeds declared size");
            await file.writeFile(chunk);
          }
          if (total !== size) throw Error("Truncated upload");
          await file.sync();
        } finally {
          await file.close();
        }
        try {
          await decryptCentralDump(encrypted, plain, password);
          stage = path.join(work, "contents");
          manifest = await extractRecoveryPackage(plain, stage);
          validateRecoveredConfiguration(
            JSON.parse(
              await readFile(path.join(stage, "recovery.json"), "utf8"),
            ),
          );
          await execute(
            "pg_restore",
            ["--list", path.join(stage, "database.dump")],
            { env, timeout: 60_000, maxBuffer: 16 * 1024 * 1024 },
          );
          const client = new pg.Client({ connectionString: target });
          try {
            await client.connect();
            await assertEmptyRecoveryTarget(client);
          } finally {
            await client.end();
          }
          json(200, {
            backupId: manifest.runId,
            createdAt: manifest.createdAt,
            applicationVersion: manifest.applicationVersion,
            files: manifest.entries.length,
            postgresMajor: manifest.postgresMajor,
          });
        } catch (error) {
          if (stage) await removeOwned(stage);
          stage = null;
          manifest = null;
          throw error;
        } finally {
          await rm(encrypted, { force: true });
          await rm(plain, { force: true });
        }
      } else if (req.url === "/restore") {
        let body = "";
        for await (const chunk of req) {
          body += chunk.toString();
          if (body.length > 4096) throw Error("Invalid request");
        }
        const confirmation = JSON.parse(body);
        if (
          !stage ||
          !manifest ||
          confirmation.backupId !== manifest.runId ||
          confirmation.confirm !== "RESTORE NEW DATABASE"
        )
          throw Error(
            "Confirm the inspected backup ID and new-database restoration",
          );
        const config = validateRecoveredConfiguration(
          JSON.parse(await readFile(path.join(stage, "recovery.json"), "utf8")),
        );
        const client = new pg.Client({ connectionString: target });
        try {
          await client.connect();
          await assertEmptyRecoveryTarget(client);
          await mkdir(output, { mode: 0o700 });
          await writeFile(
            path.join(output, "recovery-secrets.json"),
            JSON.stringify(config, null, 2),
            { flag: "wx", mode: 0o600 },
          );
          await writeFile(
            path.join(output, "recovery.env"),
            Object.entries(config)
              .map(([key, value]) =>
                value.includes("'")
                  ? "# " + key + ": copy from recovery-secrets.json"
                  : key + "='" + value + "'",
              )
              .join(String.fromCharCode(10)) + String.fromCharCode(10),
            { flag: "wx", mode: 0o600 },
          );
          await writeFile(
            path.join(output, "manifest.json"),
            JSON.stringify(manifest, null, 2),
            { flag: "wx", mode: 0o600 },
          );
          for (const entry of manifest.entries.filter((item) =>
            item.name.startsWith("downloads/"),
          )) {
            const destination = path.join(output, ...entry.name.split("/"));
            await mkdir(path.dirname(destination), {
              recursive: true,
              mode: 0o700,
            });
            await copyFile(
              path.join(stage, entry.name),
              destination,
              constants.COPYFILE_EXCL,
            );
            await chmod(destination, 0o600);
          }
          // No shell, no connection credentials in command arguments, and no destructive --clean.
          await execute(
            "pg_restore",
            [
              "--no-owner",
              "--no-acl",
              "--exit-on-error",
              "--single-transaction",
              "--dbname",
              env.PGDATABASE!,
              path.join(stage, "database.dump"),
            ],
            { env, timeout: 2 * 3600_000, maxBuffer: 16 * 1024 * 1024 },
          );
          await finalizeRecoveredDatabase(client);
          await writeFile(
            path.join(output, "RECOVERY_COMPLETE"),
            "Database restored; old platform sessions revoked. Apply recovery.env privately, provision runtime grants, test with outbound workers stopped, then enable backups.\n",
            { flag: "wx", mode: 0o600 },
          );
          restored = true;
          json(200, {
            success: true,
            message:
              "Database restored. Recovery configuration and downloads are in the private output directory. Apply settings, provision runtime grants and verify the new server before DNS cutover. Backups remain disabled until reviewed.",
          });
        } finally {
          await client.end();
        }
      } else json(404, { error: "Unknown recovery operation" });
    } catch {
      json(400, {
        error:
          "Recovery stopped. Check password/file compatibility, free disk space, an unused output directory and a new empty PostgreSQL 16 target. No existing database is overwritten. If restoration committed before a later step failed, inspect the target privately before retrying.",
      });
    } finally {
      busy = false;
      if (restored) {
        await removeOwned(work);
        server.close();
      }
    }
  });
  server.requestTimeout = 2 * 3600_000;
  server.headersTimeout = 60_000;
  server.maxConnections = 4;
  server.listen(port, "127.0.0.1", () => {
    console.log(`Local recovery: http://127.0.0.1:${port}`);
    console.log(`One-time local access token: ${token}`);
    console.log(
      "Use only trusted backups. Keep this terminal private. Apps/workers must stay stopped.",
    );
  });
  const shutdown = () => {
    server.close();
    if (!busy) void removeOwned(work).catch(() => undefined);
  };
  process.once("SIGINT", shutdown);
  process.once("SIGTERM", shutdown);
  return server;
}
function page(nonce: string) {
  return `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Nisaab360 Database Recovery</title>
<style>body{font-family:system-ui;max-width:760px;margin:3rem auto;padding:1rem}label{display:block;margin-top:1rem}input,button{padding:.7rem;margin:.3rem 0;width:100%;box-sizing:border-box}pre{white-space:pre-wrap}button{cursor:pointer}p{line-height:1.6}</style>
<h1>Restore your database on a new server</h1><p>This local tool restores a trusted encrypted backup into an empty PostgreSQL 16 database. Keep application workers stopped. Existing databases are refused.</p>
<label>Local access token from terminal<input id="token" type="password" autocomplete="off"></label><label>Encrypted backup<input id="file" type="file" accept=".n360backup"></label><label>Password from backup email<input id="password" type="password" autocomplete="off"></label><button id="inspect">Upload and check backup</button>
<pre id="result" role="status"></pre><label>Type the inspected backup ID<input id="confirmation" autocomplete="off"></label><button id="restore" disabled>Restore into new database</button>
<script nonce="${nonce}">let selected=null;const el=id=>document.getElementById(id);async function request(url,body,extra={}){const response=await fetch(url,{method:'POST',headers:{'X-Recovery-Token':el('token').value,...extra},body});const data=await response.json();if(!response.ok)throw Error(data.error);return data}el('inspect').onclick=async()=>{el('inspect').disabled=true;el('restore').disabled=true;selected=null;el('result').textContent='Uploading and verifying?';try{const file=el('file').files[0];if(!file)throw Error('Choose a backup file');const data=await request('/upload',file,{'Content-Type':'application/octet-stream','X-Backup-Password':el('password').value});selected=data.backupId;el('result').textContent=JSON.stringify(data,null,2);el('restore').disabled=false}catch(e){el('result').textContent=e.message}finally{el('password').value='';el('inspect').disabled=false}};el('restore').onclick=async()=>{if(!selected||el('confirmation').value!==selected){el('result').textContent='Type the exact inspected backup ID';return}el('restore').disabled=true;el('inspect').disabled=true;el('result').textContent='Restoring? Keep this terminal open.';try{const data=await request('/restore',JSON.stringify({backupId:selected,confirm:'RESTORE NEW DATABASE'}),{'Content-Type':'application/json'});el('result').textContent=data.message;el('token').value=''}catch(e){el('result').textContent=e.message;el('inspect').disabled=false}};</script></html>`;
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href
)
  runDatabaseRecoveryServer().catch(() => {
    console.error(
      "Recovery tool did not start. Supply the new target database, an unused absolute output directory, and compatible pg_restore.",
    );
    process.exitCode = 1;
  });
