import fs from "fs";
const env = fs.readFileSync(".env.local", "utf8");
for (const line of env.split("\n")) {
  const match = line.match(/^([^=]+)=(.*)$/);
  if (match) {
    process.env[match[1].trim()] = match[2].trim().replace(/^"|"$/g, '');
  }
}
import { neon } from '@neondatabase/serverless';

async function main() {
  try {
    const sql = neon(process.env.DATABASE_URL!);
    await sql`ALTER TABLE "super_admins" ADD COLUMN IF NOT EXISTS "is_super_admin" boolean DEFAULT false NOT NULL;`;
    await sql`UPDATE "super_admins" SET "is_super_admin" = true WHERE id = 1;`;
    console.log("Super admins updated successfully!");
  } catch (error) {
    console.error("Error updating table:", error);
  }
  process.exit(0);
}

main();
