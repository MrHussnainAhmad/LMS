import { execFile as execFileCallback } from "node:child_process";
import { promisify } from "node:util";
import { hash } from "@node-rs/argon2";

const execFile = promisify(execFileCallback);
const tag = `login-smoke-${Date.now()}`;
const identifier = `${tag}-student`;
const password = "LoginSmoke!2026";
const sql = async (statement: string) => (await execFile("docker", ["exec", "lms-backend-postgres-1", "psql", "-q", "-t", "-A", "-v", "ON_ERROR_STOP=1", "-U", "app", "-d", "app", "-c", statement])).stdout.trim();

async function curlLogin(emailOrUsername: string, value: string) {
  const { stdout } = await execFile(process.platform === "win32" ? "curl.exe" : "curl", ["-i", "-sS", "-X", "POST", "http://localhost/api/auth/login", "-H", "Content-Type: application/json", "-H", "x-forwarded-for: 198.51.100.88", "--data", JSON.stringify({ emailOrUsername, password: value })]);
  return stdout;
}

async function main() {
  let institutionId = "";
  try {
    const passwordHash = await hash(password);
    institutionId = await sql(`INSERT INTO institutions (name,type,username,logo_key,country,city,address,contact_email,contact_phone,registration_number,proof_document_key,status,admin_password_hash) VALUES ('${tag}','SCHOOL','${tag.replace(/-/g, "").slice(0, 28)}','test-logo','Test Country','Test City','Test Address','${tag}@example.test','0000000000','${tag}','test-proof','APPROVED','${passwordHash}') RETURNING id`);
    const classId = await sql(`INSERT INTO classes (institution_id,name,level) VALUES (${institutionId},'Smoke',1) RETURNING id`);
    const sectionId = await sql(`INSERT INTO sections (institution_id,class_id,name) VALUES (${institutionId},${classId},'A') RETURNING id`);
    await sql(`INSERT INTO students (institution_id,name,login_roll_number,password_hash,class_id,section_id,year_of_joining,class_roll_number,is_active,must_change_password) VALUES (${institutionId},'Smoke Student','${identifier}','${passwordHash}',${classId},${sectionId},2026,'smoke',true,false)`);
    console.log("SUCCESS_RESPONSE_BEGIN"); console.log(await curlLogin(identifier, password)); console.log("SUCCESS_RESPONSE_END");
    console.log("UNKNOWN_RESPONSE_BEGIN"); console.log(await curlLogin(`${tag}-unknown`, password)); console.log("UNKNOWN_RESPONSE_END");
  } finally {
    if (institutionId) await sql(`DELETE FROM institutions WHERE id = ${institutionId}`).catch(() => undefined);
  }
}
const keepAlive = setInterval(() => undefined, 1_000);
main().catch((error) => { console.error(error); process.exitCode = 1; }).finally(() => clearInterval(keepAlive));
