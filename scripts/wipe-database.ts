/**
 * DEV ONLY — drops and recreates the public schema.
 * Use when local/demo data is disposable.
 *
 *   npx tsx scripts/wipe-database.ts
 */
import "dotenv/config";
import pg from "pg";

async function main() {
  const url = process.env.DIRECT_URL || process.env.DATABASE_URL;
  if (!url) {
    console.error("DIRECT_URL or DATABASE_URL is required");
    process.exit(1);
  }

  if (process.env.NODE_ENV === "production" && process.env.ALLOW_DB_WIPE !== "1") {
    console.error("Refusing to wipe in production without ALLOW_DB_WIPE=1");
    process.exit(1);
  }

  const client = new pg.Client({ connectionString: url });
  await client.connect();
  try {
    console.log("Dropping and recreating public schema...");
    await client.query("DROP SCHEMA IF EXISTS public CASCADE");
    await client.query("CREATE SCHEMA public");
    await client.query("GRANT ALL ON SCHEMA public TO CURRENT_USER");
    await client.query("GRANT ALL ON SCHEMA public TO public");
    console.log("Database wiped.");
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
