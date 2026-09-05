import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { institutionBackups, institutions } from '@/db/schema';
import { getInstitutionBackupObject } from '@/lib/institution-backups';
import { requireRole } from '@/lib/rbac';
import { and, eq } from 'drizzle-orm';
import { logAudit } from '@/lib/audit';
import { getClientIp } from '@/lib/client-ip';
import { withRateLimit } from '@/lib/rate-limit';

export const GET = requireRole(['SUPER_ADMIN'], async (req: NextRequest, { params, session }) => {
  const limited = await withRateLimit(req, 'export', `backup-download:${session.userId}`);
  if (!limited.success) return NextResponse.json({ error: 'Too many backup downloads. Please wait.' }, { status: 429 });
  const { id } = await params;
  const backupId = Number.parseInt(id, 10);
  if (!Number.isInteger(backupId) || backupId <= 0) return NextResponse.json({ error: 'Invalid backup ID' }, { status: 400 });
  const [backup] = await db.select({
    id: institutionBackups.id, institutionId: institutionBackups.institutionId, backupType: institutionBackups.backupType,
    objectKey: institutionBackups.objectKey, status: institutionBackups.status, sha256: institutionBackups.sha256,
    institutionName: institutions.name,
  }).from(institutionBackups).innerJoin(institutions, eq(institutions.id, institutionBackups.institutionId))
    .where(and(eq(institutionBackups.id, backupId), eq(institutionBackups.status, 'COMPLETED'))).limit(1);
  if (!backup?.objectKey) return NextResponse.json({ error: 'Completed backup not found' }, { status: 404 });
  const object = await getInstitutionBackupObject(backup.objectKey);
  if (!object.Body) return NextResponse.json({ error: 'Backup object is empty' }, { status: 502 });
  await logAudit({ institutionId: backup.institutionId, actorId: session.userId, actorRole: session.role, action: 'DOWNLOAD_INSTITUTION_BACKUP', target: `Backup ${backup.id}`, ip: getClientIp(req) });
  const filename = `${backup.institutionName.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '')}-${backup.backupType.toLowerCase()}-${backup.id}.jsonl.gz`;
  return new NextResponse(object.Body.transformToWebStream(), {
    headers: {
      'Content-Type': 'application/gzip',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
      ...(backup.sha256 ? { 'X-Backup-SHA256': backup.sha256 } : {}),
    },
  });
});
