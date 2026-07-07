import { neon } from '@neondatabase/serverless';
import { config } from 'dotenv';
config({ path: '.env.local' });

const sql = neon(process.env.DATABASE_URL!);

async function run() {
  console.log("Running SQL directly...");
  try {
    await sql`ALTER TABLE students ADD COLUMN expo_push_token varchar(255);`;
    console.log("students table altered.");
  } catch (error: any) {
    console.log("students error:", error.message);
  }
  
  try {
    await sql`ALTER TABLE staff ADD COLUMN expo_push_token varchar(255);`;
    console.log("staff table altered.");
  } catch (error: any) {
    console.log("staff error:", error.message);
  }
}
run();
