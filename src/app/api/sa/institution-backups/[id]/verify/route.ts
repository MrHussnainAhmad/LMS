import { createHash } from 'node:crypto';
import { createGunzip } from 'node:zlib';
import { createInterface } from 'node:readline';
import type { Readable } from 'node:stream';
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { institutionBackups } from '@/db/schema';
import { getInstitutionBackupObject } from '@/lib/institution-backups';
import { requireRole } from '@/lib/rbac';
import { and, eq } from 'drizzle-orm';
import { withRateLimit } from '@/lib/rate-limit';

export const POST = requireRole(['SUPER_ADMIN'], async (req: NextRequest, { params, session }) => {
  const limited = await withRateLimit(req, 'export', `backup-verify:${session.userId}`);
  if (!limited.success) return NextResponse.json({ error: 'Too many verification requests. Please wait.' }, { status: 429 });
  const { id } = await params;
  const backupId = Number.parseInt(id, 10);
  if (!Number.isInteger(backupId) || backupId <= 0) return NextResponse.json({ error: 'Invalid backup ID' }, { status: 400 });
  const [backup] = await db.select().from(institutionBackups)
    .where(and(eq(institutionBackups.id, backupId), eq(institutionBackups.status, 'COMPLETED'))).limit(1);
  if (!backup?.objectKey || !backup.sha256) return NextResponse.json({ error: 'Completed backup not found' }, { status: 404 });
  const object = await getInstitutionBackupObject(backup.objectKey);
  if (!object.Body) return NextResponse.json({ error: 'Backup object is empty' }, { status: 502 });
  const source = object.Body as unknown as Readable;
  const hash = createHash('sha256');
  source.on('data', (chunk: Buffer) => hash.update(chunk));
  const lines = createInterface({ input: source.pipe(createGunzip()), crlfDelay: Infinity });
  let header: Record<string, unknown> | undefined;
  let manifest: Record<string, unknown> | undefined;
  for await (const line of lines) {
    if (!line) continue;
    const parsed = JSON.parse(line) as Record<string, unknown>;
    if (parsed.type === 'header') header = parsed;
    if (parsed.type === 'manifest') manifest = parsed;
  }
  const checksum = hash.digest('hex');
  const valid = checksum === backup.sha256
    && header?.format === 'nisaab360-institution-backup'
    && Number((header.institution as { id?: unknown } | undefined)?.id) === backup.institutionId
    && Number(manifest?.recordCount) === backup.recordCount;
  return NextResponse.json({ valid, checksumMatches: checksum === backup.sha256, header, manifest }, { status: valid ? 200 : 409, headers: { 'Cache-Control': 'no-store' } });
});
