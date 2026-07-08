import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import * as dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

const run = async () => {
  const sql = neon(process.env.DATABASE_URL);
  const db = drizzle(sql);

  const migrationPath = path.join(process.cwd(), 'drizzle', '0005_lucky_moondragon.sql');
  const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

  console.log("Running migration...");
  try {
    const statements = migrationSQL.split(';').filter(stmt => stmt.trim() !== '');
    for (const stmt of statements) {
      console.log("Executing:", stmt.substring(0, 50) + "...");
      await sql.query(stmt);
    }
    console.log("Migration complete!");
  } catch (error) {
    console.error("Migration failed:", error);
    process.exit(1);
  }
};

run();
