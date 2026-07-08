import { neon } from '@neondatabase/serverless';
import * as dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

dotenv.config({ path: ['.env.local', '.env'] });

async function main() {
  const sql = neon(process.env.DATABASE_URL!);
  
  const m3 = fs.readFileSync(path.join(process.cwd(), 'drizzle/0003_secret_inertia.sql'), 'utf-8');
  const m4 = fs.readFileSync(path.join(process.cwd(), 'drizzle/0004_blue_tyrannus.sql'), 'utf-8');
  const m5 = fs.readFileSync(path.join(process.cwd(), 'drizzle/0005_push_preferences.sql'), 'utf-8');
  
  const stmts = [...m3.split('--> statement-breakpoint'), ...m4.split('--> statement-breakpoint'), ...m5.split('--> statement-breakpoint')];
  
  console.log('Applying 0003, 0004, and 0005 migrations directly...');
  for (let s of stmts) {
    s = s.trim();
    if (s) {
      console.log('Executing:', s.substring(0, 50) + '...');
      await sql.query(s, []);
    }
  }
  
  console.log('Migrations complete!');
  process.exit(0);
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
