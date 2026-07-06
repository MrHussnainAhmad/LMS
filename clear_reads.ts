import { config } from 'dotenv';
config({ path: '.env.local' });
config({ path: '.env' });
import { neon } from '@neondatabase/serverless';

async function main() {
  const sql = neon(process.env.DATABASE_URL!);
  await sql`ALTER TABLE staff ADD COLUMN IF NOT EXISTS profile_picture_url varchar(255);`;
  await sql`ALTER TABLE students ADD COLUMN IF NOT EXISTS profile_picture_url varchar(255);`;
  console.log("Added profile_picture_url to staff and students");
  process.exit(0);
}

main().catch(console.error);
