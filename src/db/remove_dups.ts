import { db } from './index';
import { sql } from 'drizzle-orm';

async function main() {
  await db.execute(sql`DELETE FROM attendances WHERE id IN (SELECT id FROM (SELECT id, ROW_NUMBER() OVER(PARTITION BY student_id, date ORDER BY id) as row_num FROM attendances) t WHERE t.row_num > 1)`);
  console.log("Duplicates removed");
  process.exit(0);
}

main().catch(console.error);
