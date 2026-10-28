import { createHash } from 'node:crypto';
import { after } from 'next/server';
import { and, eq, inArray, isNull, ne, isNotNull, sql } from 'drizzle-orm';
import { db } from '@/db';
import { notifications, parentAccounts, parentStudents, students, staff, sections, pushDevices, refreshTokens, qrLoginSessions, expoPushTickets } from '@/db/schema';
import { invalidateReadCacheKeys } from '@/lib/redis';

type Store = Pick<typeof db, 'select' | 'insert'>;
export type NotificationPayload = {
  institutionId: number; userRole: 'STUDENT' | 'STAFF' | 'PARENT' | 'INSTITUTION' | 'EMPLOYEE' | 'SUPER_ADMIN';
  userId: number; type: typeof notifications.$inferInsert.type; title: string; message: string;
  referenceId?: number; studentId?: number; eventKey?: string; data?: Record<string, unknown>;
};
const parentTypes = new Set(['MARKS','TIMETABLE','EXAM_TIMETABLE','DIARY','LEAVE_REQUEST','ANNOUNCEMENT','GENERAL','FEE_VOUCHER','FEE_OVERDUE','PAYMENT']);
export function notificationScreen(type: string) {
  return ({ ASSIGNMENT:'assignments', ASSIGNMENT_REMINDER:'assignments', MARKS:'results', TIMETABLE:'timetable',
    EXAM_TIMETABLE:'exams', DIARY:'diary', LEAVE_REQUEST:'leave', TEST:'tests', ATTENDANCE:'attendance',
    FEE_VOUCHER:'fees', FEE_OVERDUE:'fees', PAYMENT:'fees', SECURITY:'security' } as Record<string,string>)[type] || 'updates';
}
const digest = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');

async function expand(payloads: NotificationPayload[], store: Store) {
  const output = [...payloads];
  const groups = new Map<number, NotificationPayload[]>();
  for (const p of payloads) if (p.userRole === 'STUDENT' && parentTypes.has(p.type)) { const group=groups.get(p.institutionId);if(group)group.push(p);else groups.set(p.institutionId,[p]); }
  for (const [institutionId, items] of groups) {
    const ids = [...new Set(items.map(p => p.userId))];
    const links = await store.select({ parentId: parentStudents.parentId, studentId: students.id, studentName: students.name,
      teacherId: sections.classTeacherId }).from(parentStudents)
      .innerJoin(parentAccounts, and(eq(parentAccounts.id,parentStudents.parentId),eq(parentAccounts.institutionId,institutionId)))
      .innerJoin(students,and(eq(students.id,parentStudents.studentId),eq(students.institutionId,institutionId)))
      .leftJoin(sections,and(eq(sections.id,students.sectionId),eq(sections.institutionId,institutionId)))
      .where(and(eq(parentStudents.institutionId,institutionId),inArray(parentStudents.studentId,ids),
        and(ne(parentAccounts.status,'DISABLED'),isNotNull(parentAccounts.passwordHash)),isNull(parentAccounts.deletedAt),isNull(students.deletedAt)));
    for (const p of items) for (const link of links.filter(l => l.studentId === p.userId)) {
      output.push({ ...p, userRole:'PARENT',userId:link.parentId,studentId:link.studentId,
        eventKey:p.eventKey?`${p.eventKey}:child:${link.studentId}`:undefined,
        message:`${link.studentName}: ${p.message}`, data:{...p.data,studentId:link.studentId} });
    }
  }
  return output;
}

async function save(payloads: NotificationPayload[], store: Store) {
  const expanded = await expand(payloads,store);
  const inserted: typeof notifications.$inferSelect[] = [];
  for (let offset=0;offset<expanded.length;offset+=500) {
    const rows = await store.insert(notifications).values(expanded.slice(offset,offset+500).map(p => ({...p,
      eventKey:p.eventKey && p.eventKey.length<=128?p.eventKey:digest(p.eventKey || [p.type,p.referenceId,p.studentId,p.title,p.message]),
      data:{screen:notificationScreen(p.type),referenceId:p.referenceId,studentId:p.studentId,...p.data},
    }))).onConflictDoNothing().returning();
    inserted.push(...rows);
  }
  return inserted;
}

export async function createNotification(payload: NotificationPayload, store: Store = db) {
  const rows=await createBulkNotifications([payload],store);
  return rows[0];
}
export async function createBulkNotifications(payloads: NotificationPayload[], store: Store = db) {
  if (!payloads.length) return [];
  const rows=await save(payloads,store);
  if (rows.length) after(async () => { await deliverNotificationIds(rows.map(r=>r.id)); });
  return rows;
}
export async function createBulkNotificationsImmediately(payloads: NotificationPayload[]) {
  if (!payloads.length) return [];
  const rows=await save(payloads,db);
  if (rows.length) await deliverNotificationIds(rows.map(r=>r.id));
  return rows;
}

/** Event-triggered HTTP delivery: no application push queue or scheduled dispatch. */
export async function deliverNotificationIds(ids: number[]) {
  try {
    // Read committed records. A rolled-back business transaction sends nothing.
    const rows=await db.select().from(notifications).where(inArray(notifications.id,ids));
    const projects = new Map<string, { token:string; row:typeof notifications.$inferSelect }[]>();
    const cacheKeys=rows.flatMap(row=>[`cache:notifications:${row.userRole}:${row.userId}:${row.institutionId}`,`cache:notifications:unread:${row.userRole}:${row.userId}:${row.institutionId}`]);
    await invalidateReadCacheKeys(cacheKeys).catch(()=>{});
    const groups=new Map<string,typeof rows>();
    for(const row of rows)if(['STUDENT','STAFF','PARENT'].includes(row.userRole)){
      const key=`${row.institutionId}:${row.userRole}`;const group=groups.get(key);if(group)group.push(row);else groups.set(key,[row]);
    }
    for(const items of groups.values()) {
      const {institutionId,userRole}=items[0];
      const ids=[...new Set(items.map(row=>row.userId))];
      const table=userRole==='STUDENT'?students:userRole==='STAFF'?staff:parentAccounts;
      const owners=await db.select({id:table.id,announcements:table.announcementPushNotificationsEnabled,legacyToken:userRole==='STUDENT'?students.expoPushToken:userRole==='STAFF'?staff.expoPushToken:sql<string|null>`null`,
        tests:userRole==='STUDENT'?students.testPushNotificationsEnabled:sql<boolean>`true`}).from(table)
        .where(and(inArray(table.id,ids),eq(table.institutionId,institutionId),isNull(table.deletedAt),
          sql`EXISTS (SELECT 1 FROM institutions i WHERE i.id=${institutionId} AND i.status='APPROVED' AND i.deleted_at IS NULL AND i.apps_enabled AND (i.parent_institution_id IS NULL OR EXISTS (SELECT 1 FROM institutions root WHERE root.id=i.parent_institution_id AND root.apps_enabled AND root.status='APPROVED' AND root.deleted_at IS NULL)))`,
          userRole==='PARENT'?and(ne(parentAccounts.status,'DISABLED'),isNotNull(parentAccounts.passwordHash)):userRole==='STUDENT'?eq(students.isActive,true):eq(staff.isActive,true)));
      const legacyTokens=owners.flatMap(owner=>owner.legacyToken?[owner.legacyToken]:[]);
      // Token identity is globally unique: even a revoked/rebound normalized row
      // blocks fallback to an older account's single-device legacy column.
      const normalized=legacyTokens.length?await db.select({token:pushDevices.token}).from(pushDevices).where(inArray(pushDevices.token,legacyTokens)):[];
      const normalizedTokens=new Set(normalized.map(device=>device.token));
      const ownerMap=new Map(owners.map(owner=>[owner.id,owner]));
      const devices=await db.select({userId:pushDevices.userId,token:pushDevices.token,projectId:pushDevices.projectId,sessionRevokedAt:refreshTokens.revokedAt}).from(pushDevices)
        .innerJoin(refreshTokens,eq(refreshTokens.tokenHash,pushDevices.sessionTokenHash))
        .where(and(eq(pushDevices.institutionId,institutionId),eq(pushDevices.userRole,userRole),inArray(pushDevices.userId,ids),
          isNull(pushDevices.revokedAt),sql`${refreshTokens.expiresAt}>clock_timestamp()`,
          sql`(${refreshTokens.qrSessionId} IS NULL OR EXISTS (SELECT 1 FROM ${qrLoginSessions} WHERE ${qrLoginSessions.id}=${refreshTokens.qrSessionId} AND ${qrLoginSessions.revokedAt} IS NULL AND ${qrLoginSessions.expiresAt}>clock_timestamp()))`));
      const childIds=items.flatMap(row=>row.studentId?[row.studentId]:[]);
      const links=userRole==='PARENT' && childIds.length?await db.select({parentId:parentStudents.parentId,studentId:parentStudents.studentId}).from(parentStudents).where(and(eq(parentStudents.institutionId,institutionId),inArray(parentStudents.parentId,ids),inArray(parentStudents.studentId,childIds))):[];
      const allowedLinks=new Set(links.map(link=>`${link.parentId}:${link.studentId}`));
      const deviceMap=new Map<number,typeof devices>();
      for(const device of devices){const group=deviceMap.get(device.userId);if(group)group.push(device);else deviceMap.set(device.userId,[device]);}
      for(const row of items){
        const owner=ownerMap.get(row.userId);if(!owner)continue;
        if(['ANNOUNCEMENT','EXAM_TIMETABLE'].includes(row.type)&&!owner.announcements)continue;
        if(row.type==='TEST'&&!owner.tests)continue;
        if(userRole==='PARENT'&&row.studentId&&!allowedLinks.has(`${row.userId}:${row.studentId}`))continue;
        if(owner.legacyToken && !normalizedTokens.has(owner.legacyToken)){
          const legacyGroup=projects.get('legacy-taleem');
          if(legacyGroup)legacyGroup.push({token:owner.legacyToken,row});else projects.set('legacy-taleem',[{token:owner.legacyToken,row}]);
        }
        for(const device of deviceMap.get(row.userId)||[]){
          if(device.sessionRevokedAt && row.type!=='SECURITY')continue;
          const group=projects.get(device.projectId);if(group)group.push({token:device.token,row});else projects.set(device.projectId,[{token:device.token,row}]);
        }
      }
    }
    // Expo forbids mixing experience/project IDs in a send request.
    for (const targets of projects.values()) for (let offset=0;offset<targets.length;offset+=100) {
      const chunk=targets.slice(offset,offset+100);
      const response=await fetch('https://exp.host/--/api/v2/push/send',{method:'POST',headers:{'Content-Type':'application/json',Accept:'application/json',
        ...(process.env.EXPO_ACCESS_TOKEN?{Authorization:`Bearer ${process.env.EXPO_ACCESS_TOKEN}`}:{})},
        body:JSON.stringify(chunk.map(({token,row})=>({to:token,title:row.title,body:row.message,sound:'default',priority:'high',channelId:'default',
          data:{...row.data,notificationId:row.id,type:row.type,referenceId:row.referenceId,studentId:row.studentId,institutionId:row.institutionId,userRole:row.userRole,userId:row.userId}}))),signal:AbortSignal.timeout(10000)});
      if (!response.ok) { console.error('[notifications] Push provider rejected request',{status:response.status,count:chunk.length}); continue; }
      const body=await response.json();
      const tickets=Array.isArray(body.data)?body.data:[];
      for (let i=0;i<chunk.length;i++) {
        const ticket=tickets[i];
        if (ticket?.status==='ok' && typeof ticket.id==='string') await db.insert(expoPushTickets).values({ticketId:ticket.id,token:chunk[i].token,userRole:chunk[i].row.userRole,userId:chunk[i].row.userId,notificationId:chunk[i].row.id}).onConflictDoNothing();
        else {
          const reason=ticket?.details?.error || 'MissingOrRejectedTicket';
          console.error('[notifications] Push ticket rejected',{reason,notificationId:chunk[i].row.id});
          if (reason==='DeviceNotRegistered') await db.update(pushDevices).set({revokedAt:new Date()}).where(eq(pushDevices.token,chunk[i].token));
        }
      }
    }
  } catch { console.error('[notifications] Direct push delivery failed; inbox records remain available.'); }
}
