import { neon } from '@neondatabase/serverless';
import * as dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

dotenv.config({ path: ['.env.local', '.env'] });

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is required');
  }

  const sql = neon(process.env.DATABASE_URL);
  const migration = fs.readFileSync(path.join(process.cwd(), 'drizzle/0005_push_preferences.sql'), 'utf-8');
  const statements = migration.split('--> statement-breakpoint').map((statement) => statement.trim()).filter(Boolean);

  console.log('Applying 0005 push preferences migration...');
  for (const statement of statements) {
    console.log('Executing:', `${statement.substring(0, 70)}...`);
    await sql.query(statement, []);
  }
  console.log('Push preferences migration complete.');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
