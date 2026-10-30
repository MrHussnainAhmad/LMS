// Explicit operator task. Does not load .env or connect unless --apply is supplied.
import pg from 'pg';
import { decryptStreamingCredentials, encryptStreamingCredentials } from '../src/lib/streaming-credentials';
async function main() {
  if (!process.argv.includes('--apply')) { console.log('Plan: re-encrypt credential columns using the current key, retaining previous keys until verification and backup recovery tests complete. Use --apply to connect.'); return; }
  if (!process.env.DIRECT_URL) throw Error('Operator DIRECT_URL required');
  // Validate key configuration before any update.
  const probe = encryptStreamingCredentials({ probe: 'test' });
  if (decryptStreamingCredentials(probe)?.probe !== 'test') throw Error('Keyring self-check failed');
  const prefix = probe.split('.').slice(0,2).join('.') + '.';
  const client = new pg.Client({ connectionString: process.env.DIRECT_URL });
  const targets = [
    ['institutions','course_streaming_credentials'], ['staff','course_streaming_credentials'],
    ['institution_payment_gateways','credentials_encrypted'], ['gateway_payment_attempts','credentials_encrypted'],
    ['institution_google_drive_backups','credentials_encrypted'], ['institution_google_drive_backups','archive_password_encrypted'],
    ['central_backup_settings','database_password_encrypted'], ['central_backup_settings','drive_credentials_encrypted'], ['central_database_backups','password_encrypted'],
    ['institution_restore_requests','payload_encrypted'], ['institution_restore_requests','recovery_encrypted'],
  ];
  let changed = 0;
  try {
    await client.connect();
    for (const [table,column] of targets) {
      // Fixed identifiers only. Each row uses optimistic comparison so concurrent writes are preserved.
      for (;;) {
        const rows = (await client.query(`SELECT ctid::text AS loc, "${column}" AS value FROM "${table}" WHERE "${column}" IS NOT NULL AND "${column}" NOT LIKE $1 LIMIT 100`, [prefix+'%'])).rows;
        if (!rows.length) break;
        for (const row of rows) {
          const value = decryptStreamingCredentials(row.value);
          if (!value) throw Error('A stored credential could not be decrypted; retain every old key and investigate');
          const encrypted = encryptStreamingCredentials(value);
          const result = await client.query(`UPDATE "${table}" SET "${column}"=$1 WHERE ctid=$2::tid AND "${column}"=$3`, [encrypted,row.loc,row.value]);
          changed += result.rowCount || 0;
        }
      }
    }
    console.log(`Re-encrypted ${changed} records. Verify application reads and backup restores before removing old keys.`);
  } finally { await client.end(); }
}
main().catch(() => { console.error('Credential migration stopped; no secret values printed. Preserve current and previous keys and review the operator configuration.'); process.exitCode=1; });
