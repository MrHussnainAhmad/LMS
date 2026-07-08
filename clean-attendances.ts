import { db } from './src/db';
import { sql } from 'drizzle-orm';

async function run() {
  await db.execute(sql`DELETE FROM attendances WHERE id IN (SELECT id FROM (SELECT id, ROW_NUMBER() OVER (partition BY student_id, date ORDER BY id) AS rnum FROM attendances) t WHERE t.rnum > 1)`);
  console.log('Duplicates removed');
  process.exit(0);
}
run();
