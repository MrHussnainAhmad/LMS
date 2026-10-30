// Synthetic/offline tests only. No .env, SMTP, Drive, application server or production targets.
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  mkdtemp,
  writeFile,
  readFile,
  rm,
  mkdir,
  access,
} from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";
import { createRequire } from "node:module";
import { build } from "esbuild";
import { PGlite } from "@electric-sql/pglite";
import { NextRequest } from "next/server";
import {
  createRecoveryPackage,
  extractRecoveryPackage,
  validateRecoveredConfiguration,
  recoveryConfiguration,
} from "../src/lib/database-recovery-package";
import {
  encryptCentralDump,
  decryptCentralDump,
  generateBackupPassword,
} from "../src/lib/central-backup-crypto";
import {
  encryptStreamingCredentials,
  decryptStreamingCredentials,
} from "../src/lib/streaming-credentials";
import {
  assertEmptyRecoveryTarget,
  finalizeRecoveredDatabase,
  postgresEnvironment,
} from "./database-recovery-server";
const require = createRequire(path.resolve("package.json"));
async function load<T>(
  entry: string,
  mocks: Record<string, string>,
): Promise<T> {
  const result = await build({
    entryPoints: [entry],
    bundle: true,
    write: false,
    platform: "node",
    format: "cjs",
    packages: "external",
    logLevel: "silent",
    plugins: [
      {
        name: "recovery-fixture",
        setup(b) {
          b.onResolve({ filter: /.*/ }, (args) =>
            mocks[args.path] !== undefined
              ? { path: args.path, namespace: "fixture" }
              : undefined,
          );
          b.onLoad({ filter: /.*/, namespace: "fixture" }, (args) => ({
            contents: mocks[args.path],
            loader: "js",
          }));
        },
      },
    ],
  });
  const m = { exports: {} as T };
  new Function("require", "module", "exports", result.outputFiles[0].text)(
    require,
    m,
    m.exports,
  );
  return m.exports;
}
test("portable encrypted recovery package restores bytes and secrets; rejects tampering, traversal and unsafe config", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "n360-package-test-"));
  const prior = process.env.STREAMING_CREDENTIALS_SECRET;
  process.env.STREAMING_CREDENTIALS_SECRET =
    "synthetic-recovery-key-at-least-32-characters";
  try {
    const dump = path.join(directory, "fixture.dump"),
      downloads = path.join(directory, "downloads"),
      packed = path.join(directory, "package");
    await mkdir(downloads);
    await writeFile(dump, Buffer.alloc(2 * 1024 * 1024, 42));
    await writeFile(
      path.join(downloads, "Example Setup.exe"),
      "synthetic installer",
    );
    await createRecoveryPackage(
      dump,
      packed,
      "manual-synthetic",
      undefined,
      downloads,
    );
    const password = generateBackupPassword(),
      encrypted = path.join(directory, "backup.n360backup");
    await encryptCentralDump(packed, encrypted, password);
    const wrong = path.join(directory, "wrong");
    await assert.rejects(() =>
      decryptCentralDump(encrypted, wrong, "incorrect-password"),
    );
    await assert.rejects(() => access(wrong));
    const plain = path.join(directory, "plain");
    await decryptCentralDump(encrypted, plain, password);
    const output = path.join(directory, "restored");
    const manifest = await extractRecoveryPackage(plain, output);
    assert.equal(manifest.runId, "manual-synthetic");
    assert.deepEqual(
      await readFile(path.join(output, "database.dump")),
      await readFile(dump),
    );
    assert.equal(
      await readFile(path.join(output, "downloads/Example Setup.exe"), "utf8"),
      "synthetic installer",
    );
    const configuration = validateRecoveredConfiguration(
      JSON.parse(await readFile(path.join(output, "recovery.json"), "utf8")),
    );
    assert.equal(
      configuration.STREAMING_CREDENTIALS_SECRET,
      process.env.STREAMING_CREDENTIALS_SECRET,
    );
    assert.equal(
      "DATABASE_URL" in
        recoveryConfiguration({
          NODE_ENV: "test",
          DATABASE_URL: "do-not-export",
          STREAMING_CREDENTIALS_SECRET: "secret",
        }),
      false,
    );
    assert.throws(() =>
      validateRecoveredConfiguration({
        version: 1,
        environment: { DATABASE_URL: "untrusted" },
      }),
    );
    assert.throws(() =>
      validateRecoveredConfiguration({
        version: 1,
        environment: {
          STREAMING_CREDENTIALS_SECRET: "x",
          NODE_OPTIONS: "untrusted",
        },
      }),
    );
    const broken = await readFile(encrypted);
    broken[broken.length - 1] ^= 1;
    await writeFile(path.join(directory, "broken"), broken);
    await assert.rejects(() =>
      decryptCentralDump(
        path.join(directory, "broken"),
        path.join(directory, "bad-output"),
        password,
      ),
    );
    await assert.rejects(() => access(path.join(directory, "bad-output")));
    const metadata = { ...manifest, entries: [...manifest.entries] };
    metadata.entries[0] = {
      ...metadata.entries[0],
      name: "downloads/../../outside",
    };
    const bytes = Buffer.from(JSON.stringify(metadata)),
      header = Buffer.alloc(12);
    header.write("N360PKG1");
    header.writeUInt32BE(bytes.length, 8);
    await writeFile(
      path.join(directory, "traversal"),
      Buffer.concat([header, bytes]),
    );
    await assert.rejects(
      () =>
        extractRecoveryPackage(
          path.join(directory, "traversal"),
          path.join(directory, "unsafe"),
        ),
      /Unsafe recovery entry/,
    );
    await assert.rejects(() => access(path.join(directory, "outside")));
    const passwords = Array.from({ length: 200 }, generateBackupPassword);
    assert.equal(new Set(passwords).size, 200);
    assert.ok(
      passwords.every(
        (value) => value.length === 24 && /^[A-Za-z0-9_-]{24}$/.test(value),
      ),
    );
  } finally {
    if (prior === undefined) delete process.env.STREAMING_CREDENTIALS_SECRET;
    else process.env.STREAMING_CREDENTIALS_SECRET = prior;
    await rm(directory, { recursive: true, force: true });
  }
});
test("central backup setup, OTP, queue, encrypted password delivery, retries and retention use actual SQL", async (t) => {
  process.env.JWT_SECRET = "synthetic-signing-key-at-least-32-characters";
  process.env.STREAMING_CREDENTIALS_SECRET =
    "synthetic-credential-key-at-least-32-characters";
  const memory = await PGlite.create();
  const state = {
    query: async (sql: string, params?: unknown[]) => {
      const value = await memory.query(sql, params);
      return { ...value, rowCount: value.affectedRows ?? value.rows.length };
    },
    mail: [] as { to: string; subject: string; text: string }[],
    failMail: false,
    deleted: [] as string[],
    session: { role: "SUPER_ADMIN", userId: 1, isSuperAdmin: true },
  };
  (globalThis as any).__databaseRecovery = state;
  const mocks: Record<string, string> = {
    "@/db":
      "export const pool={query:(...args)=>globalThis.__databaseRecovery.query(...args)};",
    "./central-backup-mail":
      'export async function sendRecoveryEmail(to,subject,text){const s=globalThis.__databaseRecovery;if(s.failMail)throw Error("Synthetic SMTP failure");s.mail.push({to,subject,text});}',
    "./argon2-pool":
      'export const verifyPassword=async(hash,password)=>hash==="synthetic-hash"&&password==="correct-current-password";',
    "./central-backup-lock":
      "export async function withCentralBackupLock(fn){return fn({query:(...args)=>globalThis.__databaseRecovery.query(...args)},new AbortController().signal)};",
    "./central-drive-backups":
      "export const verifyCentralDriveFile=async()=>true;export const deleteDriveFile=async id=>{globalThis.__databaseRecovery.deleted.push(id)};",
    "@/lib/rbac": `export const requireRole=(_roles,handler)=>async(req,context={})=>{const session=globalThis.__databaseRecovery.session;if(session.role!=='SUPER_ADMIN'||!session.isSuperAdmin)return Response.json({error:'Forbidden'},{status:403});return handler(req,{...context,session});};`,
    "@/lib/rate-limit": "export const withRateLimit=async()=>({success:true});",
    "@/lib/audit": "export const logAudit=async()=>{};",
  };
  try {
    await memory.exec(
      "CREATE TABLE super_admins(id integer PRIMARY KEY,password_hash text,is_super_admin boolean);INSERT INTO super_admins VALUES(1,'synthetic-hash',true)",
    );
    await memory.exec(
      await readFile("drizzle/0059_central_backup_settings.sql", "utf8"),
    );
    await memory.exec(
      await readFile("drizzle/0060_central_database_backups.sql", "utf8"),
    );
    await memory.exec(
      await readFile("drizzle/0076_central_backup_reconciliation.sql", "utf8"),
    );
    await memory.exec(
      await readFile("drizzle/0087_database_backup_recovery.sql", "utf8"),
    );
    await memory.exec(
      await readFile("drizzle/0087_database_backup_recovery.sql", "utf8"),
    );
    const config = await load<
      typeof import("../src/lib/central-backup-config")
    >("src/lib/central-backup-config.ts", mocks);
    const delivery = await load<
      typeof import("../src/lib/central-backup-delivery")
    >("src/lib/central-backup-delivery.ts", mocks);
    await t.test(
      "fixed Pakistan schedule and verified email are prerequisites; wrong codes are bounded and consumed codes cannot replay",
      async () => {
        assert.equal(
          config.nextNightlyBackup(new Date("2026-10-30T20:59:00Z")),
          "2026-10-30T21:00:00.000Z",
        );
        assert.equal(
          config.nextNightlyBackup(new Date("2026-10-30T21:00:01Z")),
          "2026-10-31T21:00:00.000Z",
        );
        assert.equal(
          config.backupReady(await config.getBackupSettings()),
          false,
        );
        await assert.rejects(() =>
          config.verifyBackupAdministrator(1, "wrong"),
        );
        await config.verifyBackupAdministrator(1, "correct-current-password");
        await config.beginRecoveryEmail("recovery@example.test", 1);
        const code = state.mail
          .at(-1)!
          .text.match(/Verification code: ([A-F0-9]{8})/)![1];
        const stored = await config.getBackupSettings();
        assert.ok(
          stored!.email_verification_hash &&
            !stored!.email_verification_hash.includes(code),
        );
        for (let index = 0; index < 5; index++)
          await assert.rejects(() =>
            config.confirmRecoveryEmail(
              code === "00000000" ? "FFFFFFFF" : "00000000",
            ),
          );
        await assert.rejects(() => config.confirmRecoveryEmail(code));
        await config.beginRecoveryEmail("recovery@example.test", 1);
        const fresh = state.mail
          .at(-1)!
          .text.match(/Verification code: ([A-F0-9]{8})/)![1];
        await config.confirmRecoveryEmail(fresh);
        await assert.rejects(() => config.confirmRecoveryEmail(fresh));
        assert.equal(
          (await config.getBackupSettings())!.recovery_email,
          "recovery@example.test",
        );
        await state.query(
          "UPDATE central_backup_settings SET enabled=true,drive_credentials_encrypted=$1,drive_folder_id=$2 WHERE id=1",
          [
            encryptStreamingCredentials({ refreshToken: "synthetic-refresh" }),
            "folder",
          ],
        );
        assert.equal(
          config.backupReady(await config.getBackupSettings()),
          true,
        );
      },
    );
    await t.test(
      "manual requests deduplicate while active and completed nightly identity is not queued twice",
      async () => {
        const first = await config.queueDatabaseBackup("MANUAL", 1),
          second = await config.queueDatabaseBackup("MANUAL", 1);
        assert.equal(first.run_id, second.run_id);
        await state.query("UPDATE central_backup_jobs SET status='COMPLETED'");
        const nightly = await config.queueDatabaseBackup("NIGHTLY");
        await state.query("UPDATE central_backup_jobs SET status='COMPLETED'");
        await config.queueDatabaseBackup("NIGHTLY");
        assert.equal(
          (
            await state.query(
              "SELECT * FROM central_backup_jobs WHERE kind='NIGHTLY'",
            )
          ).rows.length,
          1,
        );
        assert.ok(nightly.run_id.startsWith("nightly-"));
      },
    );
    await t.test(
      "failed SMTP retains encrypted recovery material and old copies; retry sends matching password then retains latest two",
      async () => {
        const password = generateBackupPassword();
        for (let index = 0; index < 3; index++)
          await state.query(
            `INSERT INTO central_database_backups(run_id,file_name,status,drive_file_id,drive_folder_id,package_version,created_at,password_sent_at,drive_verified_at,password_encrypted,recovery_email,file_size_bytes,sha256)
   VALUES($1,$2,$3,$4,'folder',1,now()+($5::integer * interval '1 second'),CASE WHEN $5<2 THEN now() ELSE NULL END,now(),$6,'recovery@example.test',99,$7)`,
            [
              "run-" + index,
              "database-fixture-" + index + ".n360backup",
              index < 2 ? "COMPLETED" : "FAILED",
              "remote-" + index,
              index,
              encryptStreamingCredentials({ password }),
              "a".repeat(64),
            ],
          );
        state.failMail = true;
        await assert.rejects(() =>
          delivery.deliverBackupPassword(
            { query: state.query } as any,
            "run-2",
          ),
        );
        assert.equal(state.deleted.length, 0);
        const row = (
          await state.query(
            "SELECT * FROM central_database_backups WHERE run_id='run-2'",
          )
        ).rows[0] as any;
        assert.equal(row.password_sent_at, null);
        assert.equal(
          decryptStreamingCredentials(row.password_encrypted)?.password,
          password,
        );
        assert.ok(row.next_delivery_at);
        await state.query(
          "UPDATE central_database_backups SET next_delivery_at=now()-interval '1 minute' WHERE run_id='run-2'",
        );
        state.failMail = false;
        assert.equal(await delivery.retryBackupEmailDelivery(), 1);
        const message = state.mail.at(-1)!;
        assert.equal(message.to, "recovery@example.test");
        assert.ok(message.text.includes(password));
        assert.ok(message.text.includes("run-2"));
        assert.ok(message.text.includes("database-fixture-2.n360backup"));
        assert.deepEqual(state.deleted, ["remote-0"]);
        const old = (
          await state.query(
            "SELECT password_encrypted,deleted_at FROM central_database_backups WHERE run_id='run-0'",
          )
        ).rows[0] as any;
        assert.equal(old.password_encrypted, null);
        assert.ok(old.deleted_at);
        const count = state.mail.length;
        await delivery.deliverBackupPassword(
          { query: state.query } as any,
          "run-2",
        );
        assert.equal(
          state.mail.length,
          count,
          "accepted email is not resent on an ordinary retry",
        );
      },
    );
    await t.test(
      "history/settings responses never expose passwords or Drive tokens; non-root roles are denied",
      async () => {
        const settings = await load<
          typeof import("../src/app/api/sa/central-backup/settings/route")
        >("src/app/api/sa/central-backup/settings/route.ts", mocks);
        const jobs = await load<
          typeof import("../src/app/api/sa/central-backup/jobs/route")
        >("src/app/api/sa/central-backup/jobs/route.ts", mocks);
        const request = new NextRequest(
          "https://example.test/api/sa/central-backup/settings",
        );
        const result = await settings.GET(request, {});
        const text = await result.text();
        assert.doesNotMatch(
          text,
          /password_encrypted|synthetic-refresh|email_verification_hash/,
        );
        const history = await (await jobs.GET(request, {})).text();
        assert.doesNotMatch(
          history,
          /password_encrypted|synthetic-refresh|v2\./,
        );
        await state.query("INSERT INTO central_database_backups(run_id,file_name,status,created_at) SELECT 'failed-'||n,'failed-file','FAILED',now()+interval '1 hour' FROM generate_series(1,31) n");
        const recent = await (await jobs.GET(request, {})).json();
        assert.ok(recent.backups.some((backup: {run_id: string}) => backup.run_id === 'run-1'));
        assert.ok(recent.backups.some((backup: {run_id: string}) => backup.run_id === 'run-2'));
        state.session = { role: "EMPLOYEE", userId: 1, isSuperAdmin: false };
        assert.equal((await jobs.GET(request, {})).status, 403);
        assert.equal((await settings.GET(request, {})).status, 403);
      },
    );
    await t.test(
      "background recovery gate requires Root review and fails closed",
      async () => {
        const gate = await load<
          typeof import("../src/lib/database-recovery-state")
        >("src/lib/database-recovery-state.ts", mocks);
        await state.query(
          "UPDATE central_backup_settings SET restore_review_required=true WHERE id=1",
        );
        assert.equal(await gate.databaseRecoveryPaused(), true);
        assert.equal(
          config.backupReady(await config.getBackupSettings()),
          false,
        );
        const settings = await load<
          typeof import("../src/app/api/sa/central-backup/settings/route")
        >("src/app/api/sa/central-backup/settings/route.ts", mocks);
        const request = () =>
          new NextRequest(
            "https://example.test/api/sa/central-backup/settings",
            {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                action: "finish-recovery-review",
                currentPassword: "correct-current-password",
              }),
            },
          );
        assert.equal((await settings.PUT(request(), {})).status, 403);
        state.session = { role: "SUPER_ADMIN", userId: 1, isSuperAdmin: true };
        assert.equal((await settings.PUT(request(), {})).status, 200);
        assert.equal(await gate.databaseRecoveryPaused(), false);
        const unavailable = await load<
          typeof import("../src/lib/database-recovery-state")
        >("src/lib/database-recovery-state.ts", {
          "@/db":
            'export const pool={query:async()=>{throw Error("unavailable")}};',
        });
        assert.equal(await unavailable.databaseRecoveryPaused(), true);
      },
    );
  } finally {
    await memory.close();
    delete (globalThis as any).__databaseRecovery;
  }
});
test("new-target guard rejects populated/connected/version-incompatible databases and restore retires sessions without changing passwords", async () => {
  const fixture = (objects: number, connections = 0, version = 160000) => ({
    query: async () => ({
      rows: [{ database: "new_lms", objects, connections, version }],
    }),
  });
  await assertEmptyRecoveryTarget(fixture(0) as any);
  await assert.rejects(() => assertEmptyRecoveryTarget(fixture(1) as any));
  await assert.rejects(() => assertEmptyRecoveryTarget(fixture(0, 1) as any));
  await assert.rejects(() =>
    assertEmptyRecoveryTarget(fixture(0, 0, 170000) as any),
  );
  assert.throws(() =>
    postgresEnvironment(new URL("postgres://x:x@localhost:6432/test")),
  );
  assert.throws(() =>
    postgresEnvironment(
      new URL("postgres://x:x@localhost/test?pgbouncer=true"),
    ),
  );
  const memory = await PGlite.create();
  try {
    for (const name of [
      "refresh_tokens",
      "plan_device_sessions",
      "qr_login_sessions",
      "push_devices",
    ])
      await memory.exec(
        `CREATE TABLE ${name}(id integer,revoked_at timestamptz);INSERT INTO ${name} VALUES(1,NULL)`,
      );
    await memory.exec(
      "CREATE TABLE central_backup_settings(id integer,enabled boolean,restore_review_required boolean DEFAULT false,oauth_state_hash text,oauth_state_expires_at timestamptz,email_verification_hash text,email_verification_expires_at timestamptz,pending_recovery_email text);INSERT INTO central_backup_settings(id,enabled,oauth_state_hash,oauth_state_expires_at,email_verification_hash,email_verification_expires_at,pending_recovery_email) VALUES(1,true,NULL,NULL,NULL,NULL,NULL);CREATE TABLE central_backup_jobs(status text,completed_at timestamptz,error text);INSERT INTO central_backup_jobs(status) VALUES('PENDING');CREATE TABLE central_database_backups(status text,error text);INSERT INTO central_database_backups(status) VALUES('UPLOADING');CREATE TABLE email_outbox(status text,last_error text,locked_at timestamptz);INSERT INTO email_outbox(status) VALUES('PROCESSING');CREATE TABLE students(id integer,password_hash text);INSERT INTO students VALUES(1,'unchanged-hash')",
    );
    await finalizeRecoveredDatabase({
      query: (sql: string) => memory.query(sql),
    } as any);
    assert.equal(
      (
        await memory.query<{ restore_review_required: boolean }>(
          "SELECT restore_review_required FROM central_backup_settings",
        )
      ).rows[0].restore_review_required,
      true,
    );
    for (const name of [
      "refresh_tokens",
      "plan_device_sessions",
      "qr_login_sessions",
      "push_devices",
    ])
      assert.ok(
        (await memory.query<any>(`SELECT revoked_at FROM ${name}`)).rows[0]
          .revoked_at,
      );
    assert.equal(
      (await memory.query<any>("SELECT enabled FROM central_backup_settings"))
        .rows[0].enabled,
      false,
    );
    assert.equal(
      (await memory.query<any>("SELECT status FROM email_outbox")).rows[0]
        .status,
      "FAILED",
    );
    assert.equal(
      (await memory.query<any>("SELECT password_hash FROM students")).rows[0]
        .password_hash,
      "unchanged-hash",
    );
  } finally {
    await memory.close();
  }
});

test("private recovery HTTP flow authenticates local requests, inspects encrypted upload and confirms restore without leaking target credentials", async () => {
  const { Readable } = await import("node:stream");
  const directory = await mkdtemp(
    path.join(tmpdir(), "n360-recovery-http-test-"),
  );
  const memory = await PGlite.create();
  const token = "synthetic-local-recovery-access-token-32-characters";
  const previous = {
    url: process.env.RECOVERY_DATABASE_URL,
    output: process.env.RECOVERY_OUTPUT_DIRECTORY,
    token: process.env.DATABASE_RECOVERY_TOKEN,
  };
  process.env.RECOVERY_DATABASE_URL =
    "postgres://operator:synthetic-target-password@127.0.0.1:5432/new_lms";
  process.env.RECOVERY_OUTPUT_DIRECTORY = path.join(directory, "output");
  process.env.DATABASE_RECOVERY_TOKEN = token;
  let handler: any;
  let closed = false;
  const calls: { args: string[]; env: NodeJS.ProcessEnv }[] = [];
  const state = {
    createServer: (value: any) => {
      handler = value;
      return {
        listen: () => {},
        close: () => {
          closed = true;
        },
      };
    },
    query: async (sql: string) => {
      if (sql.startsWith("SELECT current_database()"))
        return {
          rows: [
            {
              database: "new_lms",
              objects: 0,
              connections: 0,
              version: 160000,
            },
          ],
        };
      return memory.query(sql);
    },
    exec: (command: string, args: string[], options: any, callback: any) => {
      assert.equal(command, "pg_restore");
      calls.push({ args, env: options.env });
      callback(null, "", "");
    },
  };
  (globalThis as any).__recoveryHttp = state;
  try {
    for (const name of [
      "refresh_tokens",
      "plan_device_sessions",
      "qr_login_sessions",
      "push_devices",
    ])
      await memory.exec(
        `CREATE TABLE ${name}(revoked_at timestamptz);INSERT INTO ${name} VALUES(NULL)`,
      );
    await memory.exec(
      "CREATE TABLE central_backup_settings(id integer,enabled boolean,restore_review_required boolean DEFAULT false,oauth_state_hash text,oauth_state_expires_at timestamptz,email_verification_hash text,email_verification_expires_at timestamptz,pending_recovery_email text);INSERT INTO central_backup_settings(id,enabled,oauth_state_hash,oauth_state_expires_at,email_verification_hash,email_verification_expires_at,pending_recovery_email) VALUES(1,true,NULL,NULL,NULL,NULL,NULL);CREATE TABLE central_backup_jobs(status text,completed_at timestamptz,error text);CREATE TABLE central_database_backups(status text,error text);CREATE TABLE email_outbox(status text,last_error text,locked_at timestamptz)",
    );
    const service = await load<typeof import("./database-recovery-server")>(
      "scripts/database-recovery-server.ts",
      {
        "node:http":
          "export const createServer=callback=>globalThis.__recoveryHttp.createServer(callback);",
        "node:child_process":
          "export const execFile=(...args)=>globalThis.__recoveryHttp.exec(...args);",
        pg: "export default {Client:class {async connect(){}async end(){}query(sql){return globalThis.__recoveryHttp.query(sql)}}};",
      },
    );
    await service.runDatabaseRecoveryServer();
    const request = async (
      url: string,
      body: Buffer | string,
      headers: Record<string, string> = {},
    ) => {
      const bytes = Buffer.isBuffer(body) ? body : Buffer.from(body);
      const req: any = Readable.from([bytes]);
      req.url = url;
      req.method = "POST";
      req.headers = {
        host: "127.0.0.1:34871",
        origin: "http://127.0.0.1:34871",
        "x-recovery-token": token,
        "content-length": String(bytes.length),
        ...headers,
      };
      let status = 0,
        text = "";
      const res = {
        setHeader: () => {},
        writeHead: (code: number) => {
          status = code;
        },
        end: (value: string) => {
          text = value;
        },
      };
      await handler(req, res);
      return { status, data: JSON.parse(text) };
    };
    assert.equal(
      (await request("/restore", "{}", { "x-recovery-token": "incorrect" }))
        .status,
      403,
    );
    assert.equal(
      (
        await request("/restore", "{}", {
          origin: "https://other.example.test",
        })
      ).status,
      403,
    );
    assert.equal(
      (await request("/restore", "{}", { host: "other.example.test" })).status,
      403,
    );
    const dump = path.join(directory, "source.dump"),
      downloads = path.join(directory, "downloads");
    await mkdir(downloads);
    await writeFile(dump, "synthetic pg archive");
    await writeFile(path.join(downloads, "installer.exe"), "installer");
    const packed = path.join(directory, "package"),
      encrypted = path.join(directory, "backup");
    await createRecoveryPackage(
      dump,
      packed,
      "manual-http-fixture",
      undefined,
      downloads,
    );
    const password = generateBackupPassword();
    await encryptCentralDump(packed, encrypted, password);
    const upload = await request("/upload", await readFile(encrypted), {
      "x-backup-password": password,
    });
    assert.equal(upload.status, 200);
    assert.equal(upload.data.backupId, "manual-http-fixture");
    assert.ok(
      !JSON.stringify(upload.data).includes("synthetic-target-password"),
    );
    assert.equal(
      (
        await request(
          "/restore",
          JSON.stringify({
            backupId: "different",
            confirm: "RESTORE NEW DATABASE",
          }),
        )
      ).status,
      400,
    );
    const restored = await request(
      "/restore",
      JSON.stringify({
        backupId: "manual-http-fixture",
        confirm: "RESTORE NEW DATABASE",
      }),
    );
    assert.equal(restored.status, 200);
    assert.equal(restored.data.success, true);
    assert.equal(closed, true);
    assert.equal(calls.length, 2);
    assert.ok(calls[1].args.includes("--single-transaction"));
    assert.ok(calls[1].args.includes("--exit-on-error"));
    assert.ok(!calls[1].args.includes("--clean"));
    assert.ok(!calls[1].args.join(" ").includes("synthetic-target-password"));
    assert.equal(calls[1].env.PGPASSWORD, "synthetic-target-password");
    assert.equal(
      await readFile(
        path.join(directory, "output/downloads/installer.exe"),
        "utf8",
      ),
      "installer",
    );
    const env = await readFile(
      path.join(directory, "output/recovery.env"),
      "utf8",
    );
    assert.ok(env.includes(String.fromCharCode(10)));
    assert.ok(!env.includes("DATABASE_URL="));
    const secrets = JSON.parse(
      await readFile(
        path.join(directory, "output/recovery-secrets.json"),
        "utf8",
      ),
    );
    assert.equal(
      secrets.STREAMING_CREDENTIALS_SECRET,
      process.env.STREAMING_CREDENTIALS_SECRET,
    );
    await access(path.join(directory, "output/RECOVERY_COMPLETE"));
  } finally {
    if (previous.url === undefined) delete process.env.RECOVERY_DATABASE_URL;
    else process.env.RECOVERY_DATABASE_URL = previous.url;
    if (previous.output === undefined)
      delete process.env.RECOVERY_OUTPUT_DIRECTORY;
    else process.env.RECOVERY_OUTPUT_DIRECTORY = previous.output;
    if (previous.token === undefined)
      delete process.env.DATABASE_RECOVERY_TOKEN;
    else process.env.DATABASE_RECOVERY_TOKEN = previous.token;
    delete (globalThis as any).__recoveryHttp;
    await memory.close();
    await rm(directory, { recursive: true, force: true });
  }
});
