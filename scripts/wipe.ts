import * as dotenv from "dotenv";
dotenv.config({ path: [".env.local", ".env"] });

import { db } from "../src/db";
import { sql } from "drizzle-orm";

async function main() {
  console.log("Wiping all data from the database...");
  try {
    // Drop the public schema and recreate it to wipe all tables and enums instantly
    await db.execute(sql`DROP SCHEMA public CASCADE;`);
    await db.execute(sql`CREATE SCHEMA public;`);
    console.log("✅ Database wiped successfully!");
    console.log("Run 'npx drizzle-kit push' to recreate the tables.");
    process.exit(0);
  } catch (error) {
    console.error("❌ Failed to wipe database:", error);
    process.exit(1);
  }
}

main();
