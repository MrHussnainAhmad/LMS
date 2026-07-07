import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import { migrate } from 'drizzle-orm/neon-http/migrator';
import { config } from 'dotenv';
config({ path: '.env.local' });

const sql = neon(process.env.DATABASE_URL!);
const db = drizzle(sql);

async function run() {
  console.log("Running migrations...");
  try {
    await migrate(db, { migrationsFolder: './drizzle' });
    console.log("Migrations complete!");
  } catch (error) {
    console.error("Migration failed:", error);
  }
}
run();
