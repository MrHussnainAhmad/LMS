import { pool } from "@/db";
/** A restored server must not run background side effects before Root reviews it. */
export async function databaseRecoveryPaused(): Promise<boolean> {
  try {
    const {
      rows: [settings],
    } = await pool.query(
      "SELECT restore_review_required FROM central_backup_settings WHERE id=1",
    );
    return settings?.restore_review_required === true;
  } catch {
    return true;
  } // Missing migration/database access fails closed.
}
