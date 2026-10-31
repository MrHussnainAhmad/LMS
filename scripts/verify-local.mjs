import { spawnSync } from 'node:child_process';
// These commands use disposable fixtures. They do not read .env, start an app,
// mutate the current database or call AWS/Google/Cloudinary.
const checks=[
  ['node_modules/eslint/bin/eslint.js','.'],
  ['node_modules/typescript/bin/tsc','--noEmit'],
  ['scripts/audit-tenant-scope.mjs'],
  ['--import','tsx','scripts/verify-security-remediation.ts'],
  ['--import','tsx','--test','scripts/verify-central-backups.ts'],
  ['--import','tsx','--test','scripts/verify-database-recovery.ts'],
  ['--import','tsx','--test','scripts/verify-online-payments.ts'],
  ['scripts/verify-request-costs.cjs'],
  ['--import','tsx','scripts/verify-form-validation.ts'],
  ['--import','tsx','scripts/verify-public-site-builder.ts'],
  ['--import','tsx','scripts/verify-role-boundaries.ts'],
  ['--import','tsx','scripts/verify-admission-campus.tsx'],
  ['--import','tsx','scripts/verify-fee-billing.ts'],
  ['--import','tsx','scripts/verify-qr-key-rotation.ts'],
  ['--import','tsx','scripts/verify-qr-login.ts'],
  ['--import','tsx','scripts/verify-qr-attendance.ts'],
  ['--import','tsx','scripts/verify-institution-apps.ts'],
  ['--import','tsx','scripts/verify-mobile-notifications.ts'],
  ['--import','tsx','scripts/verify-serialized-lane.ts'],
];
for(const args of checks){
  const result=spawnSync(process.execPath,args,{stdio:'inherit'});
  if(result.error || result.status!==0)process.exit(result.status || 1);
}
console.log('Local verification gate passed. No services started.');
