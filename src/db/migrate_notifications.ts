import { db } from './index';
import { sql } from 'drizzle-orm';

async function main() {
  try {
    await db.execute(sql`DO $$ BEGIN CREATE TYPE notification_type AS ENUM ('ANNOUNCEMENT', 'EXAM_TIMETABLE', 'ASSIGNMENT', 'TEST', 'MARKS', 'ATTENDANCE', 'GENERAL'); EXCEPTION WHEN duplicate_object THEN null; END $$;`);
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS notifications (
        id SERIAL PRIMARY KEY,
        institution_id INTEGER NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
        user_role user_role NOT NULL,
        user_id INTEGER NOT NULL,
        type notification_type NOT NULL,
        title VARCHAR(255) NOT NULL,
        message TEXT NOT NULL,
        is_read BOOLEAN NOT NULL DEFAULT FALSE,
        reference_id INTEGER,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `);
    console.log("Notifications table created successfully!");
  } catch (error) {
    console.error(error);
  } finally {
    process.exit(0);
  }
}

main();
