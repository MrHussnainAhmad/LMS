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
    await sql`
      CREATE TABLE IF NOT EXISTS "account_deletions" (
        "id" serial PRIMARY KEY NOT NULL,
        "institution_name" varchar(255) NOT NULL,
        "admin_email" varchar(255) NOT NULL,
        "reason" text,
        "deleted_at" timestamp DEFAULT now() NOT NULL
      );
    `;
    console.log("Table created successfully!");
  } catch (error) {
    console.error("Error creating table:", error);
  }
  process.exit(0);
}

main();
