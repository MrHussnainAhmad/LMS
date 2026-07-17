import { execFile as execFileCallback } from "node:child_process";
import { promisify } from "node:util";
import { config as loadEnv } from "dotenv";
import { hash } from "@node-rs/argon2";
import { Client } from "pg";

const execFile = promisify(execFileCallback);
loadEnv({ path: ".env.local", override: false, quiet: true });
loadEnv({ path: ".env", override: false, quiet: true });

const RUN_ID = `login-audit-${Date.now()}`;
const TEST_IP = "203.0.113.77";
const BASE_URL = process.env.LOGIN_TEST_BASE_URL ?? "http://localhost";
const curl = process.platform === "win32" ? "curl.exe" : "curl";

const PASSWORD = "NisaabTest!2026";
const DUPLICATE_STUDENT_PASSWORD = "StudentDup!2026";
const DUPLICATE_STAFF_PASSWORD = "StaffDup!2026";

const identifiers = {
  student: `${RUN_ID}-student`,
  staff: `${RUN_ID}-staff@example.test`,
  unknown: `${RUN_ID}-unknown@example.test`,
  duplicate: `${RUN_ID}-duplicate@example.test`,
  hinted: `${RUN_ID}-hinted-student`,
  cached: `${RUN_ID}-cached-student`,
};

type LoginResponse = { status: number; body: Record<string, unknown> };
type TestResult = { name: string; passed: boolean; detail: string };

function localDatabaseUrl() {
  const configured = process.env.LOGIN_TEST_DATABASE_URL ?? process.env.DIRECT_URL ?? process.env.DATABASE_URL;
  if (!configured) throw new Error("Set LOGIN_TEST_DATABASE_URL, DIRECT_URL, or DATABASE_URL.");

  const url = new URL(configured);
  // docker-compose.yml exposes Postgres directly on localhost:5433.
  if (url.hostname === "postgres" || url.hostname === "pgbouncer") {
    url.hostname = "127.0.0.1";
    url.port = "5433";
  }
  return url.toString();
}

async function compose(...args: string[]) {
  return execFile("docker", ["compose", ...args], { cwd: process.cwd() });
}

async function clearValkeyKeys(keys: string[]) {
  await compose("exec", "-T", "valkey", "valkey-cli", "DEL", ...keys);
}

async function valkeyGet(key: string) {
  const { stdout } = await compose("exec", "-T", "valkey", "valkey-cli", "GET", key);
  return stdout.trim();
}

async function login(emailOrUsername: string, password: string, roleHint?: string): Promise<LoginResponse> {
  const payload = JSON.stringify({ emailOrUsername, password, ...(roleHint ? { roleHint } : {}) });
  const { stdout } = await execFile(curl, [
    "-sS",
    "-X", "POST", `${BASE_URL}/api/auth/login`,
    "-H", "Content-Type: application/json",
    "-H", `x-forwarded-for: ${TEST_IP}`,
    "--data", payload,
    "-w", "\n%{http_code}",
  ]);
  const lastNewline = stdout.lastIndexOf("\n");
  const status = Number.parseInt(stdout.slice(lastNewline + 1).trim(), 10);
  const bodyText = stdout.slice(0, lastNewline);
  return { status, body: JSON.parse(bodyText) as Record<string, unknown> };
}

function isSuccess(response: LoginResponse, role: string) {
  return response.status === 200 && response.body.role === role;
}

async function setStatementLogging(client: Client, enabled: boolean) {
  await client.query(enabled ? "ALTER SYSTEM SET log_statement = 'all'" : "ALTER SYSTEM RESET log_statement");
  await client.query("SELECT pg_reload_conf()");
}

async function main() {
  const client = new Client({ connectionString: localDatabaseUrl() });
  const results: TestResult[] = [];
  let institutionId: number | undefined;
  let statementLoggingEnabled = false;
  const rateKey = `ratelimit:auth:${TEST_IP}`;
  const roleKeys = Object.values(identifiers).map((identifier) => `auth:role:${identifier}`);

  try {
    await client.connect();
    await fetch(`${BASE_URL}/api/health`).then((response) => {
      if (!response.ok) throw new Error(`Application health check returned ${response.status}`);
    });

    const [passwordHash, duplicateStudentHash, duplicateStaffHash] = await Promise.all([
      hash(PASSWORD),
      hash(DUPLICATE_STUDENT_PASSWORD),
      hash(DUPLICATE_STAFF_PASSWORD),
    ]);

    await client.query("BEGIN");
    const institution = await client.query<{ id: number }>(`
      INSERT INTO institutions (
        name, type, username, logo_key, country, city, address, contact_email,
        contact_phone, registration_number, proof_document_key, status, admin_password_hash
      ) VALUES ($1, 'SCHOOL', $2, 'test-logo', 'Test Country', 'Test City', 'Test Address', $3,
        '0000000000', $4, 'test-proof', 'APPROVED', $5)
      RETURNING id
    `, [`${RUN_ID} institution`, `audit${Date.now()}`, `${RUN_ID}@example.test`, RUN_ID, passwordHash]);
    institutionId = institution.rows[0].id;

    const classRow = await client.query<{ id: number }>(
      "INSERT INTO classes (institution_id, name, level) VALUES ($1, 'Audit Class', 1) RETURNING id",
      [institutionId],
    );
    const classId = classRow.rows[0].id;
    const sectionRow = await client.query<{ id: number }>(
      "INSERT INTO sections (institution_id, class_id, name) VALUES ($1, $2, 'A') RETURNING id",
      [institutionId, classId],
    );
    const sectionId = sectionRow.rows[0].id;

    const insertStudent = async (loginRollNumber: string, passwordHashValue: string, roll: string) => {
      await client.query(`
        INSERT INTO students (
          institution_id, name, login_roll_number, password_hash, class_id, section_id,
          year_of_joining, class_roll_number, is_active, must_change_password
        ) VALUES ($1, $2, $3, $4, $5, $6, 2026, $7, true, false)
      `, [institutionId, `Audit ${roll}`, loginRollNumber, passwordHashValue, classId, sectionId, roll]);
    };
    const insertStaff = async (email: string, passwordHashValue: string, name: string) => {
      await client.query(`
        INSERT INTO staff (institution_id, name, email, password_hash, is_active, must_change_password)
        VALUES ($1, $2, $3, $4, true, false)
      `, [institutionId, name, email, passwordHashValue]);
    };

    await insertStudent(identifiers.student, passwordHash, "student");
    await insertStaff(identifiers.staff, passwordHash, "Audit Staff");
    await insertStudent(identifiers.duplicate, duplicateStudentHash, "duplicate-student");
    await insertStaff(identifiers.duplicate, duplicateStaffHash, "Audit Duplicate Staff");
    await insertStudent(identifiers.hinted, passwordHash, "hinted");
    await insertStudent(identifiers.cached, passwordHash, "cached");
    await client.query("COMMIT");

    await clearValkeyKeys([rateKey, ...roleKeys]);

    const student = await login(identifiers.student, PASSWORD);
    results.push({ name: "1. Unhinted student", passed: isSuccess(student, "STUDENT"), detail: `HTTP ${student.status}; role=${String(student.body.role)}` });

    const staff = await login(identifiers.staff, PASSWORD);
    results.push({ name: "2. Unhinted staff", passed: isSuccess(staff, "STAFF"), detail: `HTTP ${staff.status}; role=${String(staff.body.role)}` });

    await clearValkeyKeys([rateKey, `auth:role:${identifiers.unknown}`]);
    await setStatementLogging(client, true);
    statementLoggingEnabled = true;
    const logStart = new Date(Date.now() - 2000).toISOString();
    const unknown = await login(identifiers.unknown, PASSWORD);
    await new Promise((resolve) => setTimeout(resolve, 250));
    const { stdout: postgresLogs } = await compose("logs", "--since", logStart, "postgres");
    const candidateQueryCount = (postgresLogs.match(/WITH login_input/g) ?? []).length;
    results.push({
      name: "3. Unknown identifier / one-query assertion",
      passed: unknown.status === 401 && unknown.body.error === "Invalid credentials" && candidateQueryCount === 1,
      detail: `HTTP ${unknown.status}; candidate-query log entries=${candidateQueryCount}`,
    });
    await setStatementLogging(client, false);
    statementLoggingEnabled = false;

    await clearValkeyKeys([rateKey, `auth:role:${identifiers.duplicate}`]);
    const duplicateStudent = await login(identifiers.duplicate, DUPLICATE_STUDENT_PASSWORD);
    await clearValkeyKeys([rateKey, `auth:role:${identifiers.duplicate}`]);
    const duplicateStaff = await login(identifiers.duplicate, DUPLICATE_STAFF_PASSWORD);
    results.push({
      name: "4. Duplicate identifier priority",
      passed: isSuccess(duplicateStudent, "STUDENT") && duplicateStaff.status === 401,
      detail: `student password: HTTP ${duplicateStudent.status}, role=${String(duplicateStudent.body.role)}; staff password: HTTP ${duplicateStaff.status}`,
    });

    const hinted = await login(identifiers.hinted, PASSWORD, "STUDENT");
    results.push({ name: "5. Role-hint regression", passed: isSuccess(hinted, "STUDENT"), detail: `HTTP ${hinted.status}; role=${String(hinted.body.role)}` });

    await clearValkeyKeys([rateKey, `auth:role:${identifiers.cached}`]);
    const cachedFirst = await login(identifiers.cached, PASSWORD);
    const cachedRole = await valkeyGet(`auth:role:${identifiers.cached}`);
    const cachedSecond = await login(identifiers.cached, PASSWORD);
    results.push({
      name: "6. Role-cache regression",
      passed: isSuccess(cachedFirst, "STUDENT") && cachedRole === "STUDENT" && isSuccess(cachedSecond, "STUDENT"),
      detail: `first: HTTP ${cachedFirst.status}; cache=${cachedRole || "(empty)"}; second: HTTP ${cachedSecond.status}`,
    });
  } catch (error) {
    results.push({ name: "Harness", passed: false, detail: error instanceof Error ? error.message : String(error) });
  } finally {
    if (statementLoggingEnabled) {
      await setStatementLogging(client, false).catch(() => undefined);
    }
    if (institutionId) {
      await client.query("DELETE FROM institutions WHERE id = $1", [institutionId]).catch(() => undefined);
    }
    await clearValkeyKeys([rateKey, ...roleKeys]).catch(() => undefined);
    await client.end().catch(() => undefined);
  }

  for (const result of results) {
    console.log(`${result.passed ? "PASS" : "FAIL"} - ${result.name}: ${result.detail}`);
  }
  if (results.some((result) => !result.passed)) process.exitCode = 1;
}

void main();
