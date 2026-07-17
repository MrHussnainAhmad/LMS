import { execFile as execFileCallback } from "node:child_process";
import { promisify } from "node:util";
import { config as loadEnv } from "dotenv";
import { hash } from "@node-rs/argon2";

const execFile = promisify(execFileCallback);
loadEnv({ path: ".env.local", override: false, quiet: true });
loadEnv({ path: ".env", override: false, quiet: true });

const runId = `login-audit-${Date.now()}`;
const ip = "203.0.113.77";
const baseUrl = process.env.LOGIN_TEST_BASE_URL ?? "http://localhost";
const postgresUser = process.env.POSTGRES_USER ?? "app";
const postgresDb = process.env.POSTGRES_DB ?? "app";
const postgresContainer = "lms-backend-postgres-1";
const curl = process.platform === "win32" ? "curl.exe" : "curl";
const password = "NisaabTest!2026";
const studentDupPassword = "StudentDup!2026";
const staffDupPassword = "StaffDup!2026";
const ids = {
  student: `${runId}-student`, staff: `${runId}-staff@example.test`, unknown: `${runId}-unknown@example.test`,
  duplicate: `${runId}-duplicate@example.test`, hinted: `${runId}-hinted-student`, cached: `${runId}-cached-student`,
};

const quote = (value: string | number | boolean | null) => value === null ? "NULL" : typeof value === "number" || typeof value === "boolean" ? String(value) : `'${value.replace(/'/g, "''")}'`;
const compose = (...args: string[]) => execFile("docker", ["compose", ...args], { cwd: process.cwd() });
async function sql(statement: string) {
  const { stdout } = await execFile("docker", ["exec", postgresContainer, "psql", "-q", "-v", "ON_ERROR_STOP=1", "-U", postgresUser, "-d", postgresDb, "-t", "-A", "-c", statement]);
  return stdout.trim();
}
async function clearKeys(keys: string[]) { await compose("exec", "-T", "valkey", "valkey-cli", "DEL", ...keys); }
async function redisGet(key: string) { return (await compose("exec", "-T", "valkey", "valkey-cli", "GET", key)).stdout.trim(); }
async function request(identifier: string, secret: string, roleHint?: string) {
  const payload = JSON.stringify({ emailOrUsername: identifier, password: secret, ...(roleHint ? { roleHint } : {}) });
  const { stdout } = await execFile(curl, ["-sS", "-X", "POST", `${baseUrl}/api/auth/login`, "-H", "Content-Type: application/json", "-H", `x-forwarded-for: ${ip}`, "--data", payload, "-w", "\n%{http_code}"]);
  const split = stdout.lastIndexOf("\n");
  return { status: Number(stdout.slice(split + 1).trim()), body: JSON.parse(stdout.slice(0, split)) as Record<string, unknown> };
}
const success = (response: Awaited<ReturnType<typeof request>>, role: string) => response.status === 200 && response.body.role === role;

async function main() {
  const results: { name: string; passed: boolean; detail: string }[] = [];
  let institutionId = "";
  let logging = false;
  const rateKey = `ratelimit:auth:${ip}`;
  const roleKeys = Object.values(ids).map((identifier) => `auth:role:${identifier}`);
  try {
    const health = await fetch(`${baseUrl}/api/health`);
    if (!health.ok) throw new Error(`health check returned ${health.status}`);
    const [normalHash, dupStudentHash, dupStaffHash] = await Promise.all([hash(password), hash(studentDupPassword), hash(staffDupPassword)]);
    const username = `audit${Date.now()}`;
    institutionId = await sql(`INSERT INTO institutions (name,type,username,logo_key,country,city,address,contact_email,contact_phone,registration_number,proof_document_key,status,admin_password_hash) VALUES (${quote(`${runId} institution`)},'SCHOOL',${quote(username)},'test-logo','Test Country','Test City','Test Address',${quote(`${runId}@example.test`)},'0000000000',${quote(runId)},'test-proof','APPROVED',${quote(normalHash)}) RETURNING id`);
    const classId = await sql(`INSERT INTO classes (institution_id,name,level) VALUES (${institutionId},'Audit Class',1) RETURNING id`);
    const sectionId = await sql(`INSERT INTO sections (institution_id,class_id,name) VALUES (${institutionId},${classId},'A') RETURNING id`);
    const addStudent = async (identifier: string, passwordHash: string, roll: string) => sql(`INSERT INTO students (institution_id,name,login_roll_number,password_hash,class_id,section_id,year_of_joining,class_roll_number,is_active,must_change_password) VALUES (${institutionId},${quote(`Audit ${roll}`)},${quote(identifier)},${quote(passwordHash)},${classId},${sectionId},2026,${quote(roll)},true,false)`);
    const addStaff = async (email: string, passwordHash: string, name: string) => sql(`INSERT INTO staff (institution_id,name,email,password_hash,is_active,must_change_password) VALUES (${institutionId},${quote(name)},${quote(email)},${quote(passwordHash)},true,false)`);
    await addStudent(ids.student, normalHash, "student"); await addStaff(ids.staff, normalHash, "Audit Staff");
    await addStudent(ids.duplicate, dupStudentHash, "duplicate-student"); await addStaff(ids.duplicate, dupStaffHash, "Audit Duplicate Staff");
    await addStudent(ids.hinted, normalHash, "hinted"); await addStudent(ids.cached, normalHash, "cached");
    await clearKeys([rateKey, ...roleKeys]);

    const student = await request(ids.student, password);
    results.push({ name: "1. Unhinted student", passed: success(student, "STUDENT"), detail: `HTTP ${student.status}; role=${String(student.body.role)}` });
    const staff = await request(ids.staff, password);
    results.push({ name: "2. Unhinted staff", passed: success(staff, "STAFF"), detail: `HTTP ${staff.status}; role=${String(staff.body.role)}` });

    await clearKeys([rateKey, `auth:role:${ids.unknown}`]);
    await sql("ALTER SYSTEM SET log_statement = 'all'"); await sql("SELECT pg_reload_conf()"); logging = true;
    const logStart = new Date(Date.now() - 2000).toISOString();
    const unknown = await request(ids.unknown, password); await new Promise((resolve) => setTimeout(resolve, 300));
    const logs = (await compose("logs", "--since", logStart, "postgres")).stdout;
    const candidateQueries = (logs.match(/WITH login_input/g) ?? []).length;
    results.push({ name: "3. Unknown identifier / one-query assertion", passed: unknown.status === 401 && unknown.body.error === "Invalid credentials" && candidateQueries === 1, detail: `HTTP ${unknown.status}; candidate-query log entries=${candidateQueries}` });
    await sql("ALTER SYSTEM RESET log_statement"); await sql("SELECT pg_reload_conf()"); logging = false;

    await clearKeys([rateKey, `auth:role:${ids.duplicate}`]); const duplicateStudent = await request(ids.duplicate, studentDupPassword);
    await clearKeys([rateKey, `auth:role:${ids.duplicate}`]); const duplicateStaff = await request(ids.duplicate, staffDupPassword);
    results.push({ name: "4. Duplicate identifier priority", passed: success(duplicateStudent, "STUDENT") && duplicateStaff.status === 401, detail: `student password: HTTP ${duplicateStudent.status}, role=${String(duplicateStudent.body.role)}; staff password: HTTP ${duplicateStaff.status}` });
    const hinted = await request(ids.hinted, password, "STUDENT");
    results.push({ name: "5. Role-hint regression", passed: success(hinted, "STUDENT"), detail: `HTTP ${hinted.status}; role=${String(hinted.body.role)}` });
    await clearKeys([rateKey, `auth:role:${ids.cached}`]); const first = await request(ids.cached, password); const cachedRole = await redisGet(`auth:role:${ids.cached}`); const second = await request(ids.cached, password);
    results.push({ name: "6. Role-cache regression", passed: success(first, "STUDENT") && cachedRole === "STUDENT" && success(second, "STUDENT"), detail: `first: HTTP ${first.status}; cache=${cachedRole || "(empty)"}; second: HTTP ${second.status}` });
  } catch (error) { results.push({ name: "Harness", passed: false, detail: error instanceof Error ? error.message : String(error) }); }
  finally {
    if (logging) { await sql("ALTER SYSTEM RESET log_statement").catch(() => undefined); await sql("SELECT pg_reload_conf()").catch(() => undefined); }
    if (institutionId) await sql(`DELETE FROM institutions WHERE id = ${institutionId}`).catch(() => undefined);
    await clearKeys([rateKey, ...roleKeys]).catch(() => undefined);
  }
  for (const result of results) console.log(`${result.passed ? "PASS" : "FAIL"} - ${result.name}: ${result.detail}`);
  if (results.some((result) => !result.passed)) process.exitCode = 1;
}
const keepAlive = setInterval(() => undefined, 1_000);
main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => clearInterval(keepAlive));
