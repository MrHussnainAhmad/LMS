// Operator recovery for accounts whose retired shared password no longer works.
// Does not load .env, contact the database or write credentials without --apply.
import pg from 'pg';
import { hash } from '@node-rs/argon2';
import { randomBytes } from 'node:crypto';
import { open } from 'node:fs/promises';
import path from 'node:path';
const targets = { INSTITUTION:['institutions','admin_password_hash','contact_email'], EMPLOYEE:['employees','password_hash','email'], STUDENT:['students','password_hash','login_roll_number'], STAFF:['staff','password_hash','email'] };
async function main() {
  if (!process.argv.includes('--apply')) { console.log('Plan: reset ONE identified account to a random temporary credential and revoke its sessions transactionally. Set SECURITY_RESET_ROLE, SECURITY_RESET_ID, SECURITY_CREDENTIAL_EXPORT_PATH and operator DIRECT_URL, then use --apply.'); return; }
  const role=process.env.SECURITY_RESET_ROLE, id=Number(process.env.SECURITY_RESET_ID), target=targets[role];
  const filename=process.env.SECURITY_CREDENTIAL_EXPORT_PATH;
  if(!target||!Number.isSafeInteger(id)||id<=0||!filename||!path.isAbsolute(filename)||!process.env.DIRECT_URL)throw Error('Explicit account identity, private export path and operator connection are required');
  if(filename.split(/[\\/]/).some(segment=>segment.toLowerCase()==='public'))throw Error('Credential export must be outside public directories');
  const output=await open(filename,'wx',0o600);
  const password=randomBytes(18).toString('base64url'), passwordHash=await hash(password);
  const client=new pg.Client({connectionString:process.env.DIRECT_URL});
  try {
    await client.connect();await client.query('BEGIN');
    const [table,column,identifier]=target;
    const {rows:[account]}=await client.query(`SELECT id,"${identifier}" AS identifier FROM "${table}" WHERE id=$1 FOR UPDATE`,[id]);
    if(!account)throw Error('Account not found');
    // Persist recovery material before committing; a failed transaction leaves an unused credential, never an inaccessible changed account.
    await output.writeFile(JSON.stringify({role,id,identifier:account.identifier,temporaryPassword:password,status:'prepared'})+'\n');await output.sync();
    await client.query(`UPDATE "${table}" SET "${column}"=$1,must_change_password=true WHERE id=$2`,[passwordHash,id]);
    for(const tableName of ['refresh_tokens','plan_device_sessions','qr_login_sessions','push_devices'])await client.query(`UPDATE "${tableName}" SET revoked_at=now() WHERE user_role=$1 AND user_id=$2 AND revoked_at IS NULL`,[role,id]);
    await client.query('COMMIT');await output.writeFile(JSON.stringify({status:'committed'})+'\n');await output.sync();
    console.log('Account reset and sessions revoked. Share the private credential file only with the verified account owner, then remove it securely.');
  } catch {await client.query('ROLLBACK').catch(()=>{});throw Error('Reset failed or its final receipt could not be written; verify account state before retrying');}
  finally {await output.close();await client.end();}
}
main().catch(()=>{console.error('Recovery stopped; no password, identifier or connection secret printed. Inspect the prepared/committed receipt in the private output file and the operator configuration.');process.exitCode=1;});
