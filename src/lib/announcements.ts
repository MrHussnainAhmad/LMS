import { db } from "@/db";
import { announcementReads, announcements, staff, staffAssignments, students, sections, parentAccounts, parentStudents, auditLogs, type AnnouncementResponse } from "@/db/schema";
import type { JWTPayload } from "@/lib/auth-types";
import { and, desc, eq, inArray, gte, isNull, or, sql } from "drizzle-orm";
import { getUserCreatedAt } from "@/lib/user";
import { getCachedOrFetch, invalidateAnnouncementReadCaches } from "@/lib/redis";
import { getParentPortalContext } from './parent-access';
import { ActionInputError } from './action-input-error';
import { pakistanDateKey } from './parent-period';
import { z } from 'zod';
export const announcementResponsePolicySchema=z.object({mode:z.enum(['NONE','ACKNOWLEDGE','CONSENT']).default('NONE'),dueDate:z.string().date().optional()})
  .refine(value=>!value.dueDate||value.dueDate>=pakistanDateKey(),'Choose today or a future response deadline.');

export type AnnouncementRecipientRole = "STUDENT" | "STAFF";

export type AnnouncementRecipient = {
  userRole: AnnouncementRecipientRole;
  userId: number;
};

export type VisibleAnnouncement = {
  id: number;
  title: string;
  content: string;
  targetType: "ALL" | "CAMPUS" | "CLASS" | "SECTION" | "USER";
  senderRole: JWTPayload["role"];
  createdAtIso: string;
  isRead: boolean;
  responsePolicy: typeof announcements.$inferSelect['responsePolicy'];
  response?: AnnouncementResponse;
};

type AnnouncementRow = typeof announcements.$inferSelect;

function getSessionInstitutionId(session: JWTPayload) {
  return session.institutionId ?? (session.role === "INSTITUTION" ? session.userId : undefined);
}

function addRecipient(
  recipients: Map<string, AnnouncementRecipient>,
  announcement: AnnouncementRow,
  userRole: AnnouncementRecipientRole,
  userId: number | null
) {
  if (!userId) return;
  if (announcement.senderRole === userRole && announcement.senderId === userId) return;
  recipients.set(`${userRole}:${userId}`, { userRole, userId });
}

export async function resolveAnnouncementRecipients(announcement: AnnouncementRow): Promise<AnnouncementRecipient[]> {
  const recipients = new Map<string, AnnouncementRecipient>();
  const includeStaffAudience = announcement.senderRole === "INSTITUTION";

  if (announcement.targetType === "ALL") {
    const allStudents = await db
      .select({ id: students.id })
      .from(students)
      .where(eq(students.institutionId, announcement.institutionId));

    allStudents.forEach((student) => addRecipient(recipients, announcement, "STUDENT", student.id));

    if (includeStaffAudience) {
      const allStaff = await db
        .select({ id: staff.id })
        .from(staff)
        .where(eq(staff.institutionId, announcement.institutionId));

      allStaff.forEach((staffMember) => addRecipient(recipients, announcement, "STAFF", staffMember.id));
    }
  } else if (announcement.targetType === "CAMPUS" && announcement.targetCampusId) {
    const campusStudents = await db
      .select({ id: students.id })
      .from(students)
      .where(and(
        eq(students.institutionId, announcement.institutionId),
        eq(students.campusId, announcement.targetCampusId)
      ));

    campusStudents.forEach((student) => addRecipient(recipients, announcement, "STUDENT", student.id));

    if (includeStaffAudience) {
      const campusStaff = await db
        .select({ id: staff.id })
        .from(staff)
        .where(and(
          eq(staff.institutionId, announcement.institutionId),
          eq(staff.campusId, announcement.targetCampusId)
        ));

      campusStaff.forEach((staffMember) => addRecipient(recipients, announcement, "STAFF", staffMember.id));
    }
  } else if (announcement.targetType === "CLASS" && announcement.targetClassId) {
    const classStudents = await db
      .select({ id: students.id })
      .from(students)
      .where(and(
        eq(students.institutionId, announcement.institutionId),
        eq(students.classId, announcement.targetClassId)
      ));

    classStudents.forEach((student) => addRecipient(recipients, announcement, "STUDENT", student.id));

    if (includeStaffAudience) {
      const classStaff = await db
        .select({ id: staffAssignments.staffId })
        .from(staffAssignments)
        .innerJoin(sections, eq(staffAssignments.sectionId, sections.id))
        .where(and(
          eq(staffAssignments.institutionId, announcement.institutionId),
          eq(sections.institutionId, announcement.institutionId),
          eq(sections.classId, announcement.targetClassId)
        ));

      classStaff.forEach((staffMember) => addRecipient(recipients, announcement, "STAFF", staffMember.id));
    }
  } else if (announcement.targetType === "SECTION" && announcement.targetSectionId) {
    const sectionStudents = await db
      .select({ id: students.id })
      .from(students)
      .where(and(
        eq(students.institutionId, announcement.institutionId),
        eq(students.sectionId, announcement.targetSectionId)
      ));

    sectionStudents.forEach((student) => addRecipient(recipients, announcement, "STUDENT", student.id));

    if (includeStaffAudience) {
      const sectionStaff = await db
        .select({ id: staffAssignments.staffId })
        .from(staffAssignments)
        .where(and(
          eq(staffAssignments.institutionId, announcement.institutionId),
          eq(staffAssignments.sectionId, announcement.targetSectionId)
        ));

      sectionStaff.forEach((staffMember) => addRecipient(recipients, announcement, "STAFF", staffMember.id));
    }
  } else if (announcement.targetType === "USER" && announcement.targetUserRole) {
    if (announcement.targetUserRole === "STUDENT") {
      if (announcement.targetUserId) {
        addRecipient(recipients, announcement, "STUDENT", announcement.targetUserId);
      } else {
        const roleStudents = await db
          .select({ id: students.id })
          .from(students)
          .where(eq(students.institutionId, announcement.institutionId));

        roleStudents.forEach((student) => addRecipient(recipients, announcement, "STUDENT", student.id));
      }
    } else if (announcement.targetUserRole === "STAFF") {
      if (announcement.targetUserId) {
        addRecipient(recipients, announcement, "STAFF", announcement.targetUserId);
      } else {
        const roleStaff = await db
          .select({ id: staff.id })
          .from(staff)
          .where(eq(staff.institutionId, announcement.institutionId));

        roleStaff.forEach((staffMember) => addRecipient(recipients, announcement, "STAFF", staffMember.id));
      }
    }
  }

  return Array.from(recipients.values());
}

async function isAnnouncementRecipient(announcement: AnnouncementRow, session: JWTPayload, studentId?: number) {
  if (session.role === 'PARENT') {
    const context=await getParentPortalContext(session,studentId,{selectedOnly:Boolean(studentId)});
    for(const child of context.children) if(announcement.createdAt>=child.createdAt && await isAnnouncementRecipient(announcement,{...session,role:'STUDENT',userId:child.id})) return true;
    return false;
  }
  if (session.role !== "STUDENT" && session.role !== "STAFF") {
    return false;
  }

  // Matches addRecipient(): an author is never a recipient of their own announcement.
  if (
    announcement.senderRole === session.role &&
    announcement.senderId === session.userId
  ) {
    return false;
  }

  if (session.role === "STUDENT") {
    const baseConditions = [
      eq(students.id, session.userId),
      eq(students.institutionId, announcement.institutionId),
    ];

    switch (announcement.targetType) {
      case "ALL":
        break;

      case "CAMPUS":
        if (!announcement.targetCampusId) return false;
        baseConditions.push(
          eq(students.campusId, announcement.targetCampusId)
        );
        break;

      case "CLASS":
        if (!announcement.targetClassId) return false;
        baseConditions.push(
          eq(students.classId, announcement.targetClassId)
        );
        break;

      case "SECTION":
        if (!announcement.targetSectionId) return false;
        baseConditions.push(
          eq(students.sectionId, announcement.targetSectionId)
        );
        break;

      case "USER":
        if (announcement.targetUserRole !== "STUDENT") return false;
        if (
          announcement.targetUserId !== null &&
          announcement.targetUserId !== session.userId
        ) {
          return false;
        }
        break;

      default:
        return false;
    }

    const [recipient] = await db
      .select({ id: students.id })
      .from(students)
      .where(and(
        eq(students.institutionId, announcement.institutionId),
        ...baseConditions,
      ))
      .limit(1);

    return Boolean(recipient);
  }

  // USER-targeted staff announcements do not require an institution sender;
  // this exactly matches resolveAnnouncementRecipients().
  if (announcement.targetType === "USER") {
    if (announcement.targetUserRole !== "STAFF") return false;
    if (
      announcement.targetUserId !== null &&
      announcement.targetUserId !== session.userId
    ) {
      return false;
    }

    const [recipient] = await db
      .select({ id: staff.id })
      .from(staff)
      .where(and(
        eq(staff.id, session.userId),
        eq(staff.institutionId, announcement.institutionId)
      ))
      .limit(1);

    return Boolean(recipient);
  }

  // Current code includes staff for ALL/CAMPUS/CLASS/SECTION only when
  // the sender is the institution.
  if (announcement.senderRole !== "INSTITUTION") {
    return false;
  }

  if (announcement.targetType === "ALL") {
    const [recipient] = await db
      .select({ id: staff.id })
      .from(staff)
      .where(and(
        eq(staff.id, session.userId),
        eq(staff.institutionId, announcement.institutionId)
      ))
      .limit(1);

    return Boolean(recipient);
  }

  if (announcement.targetType === "CAMPUS") {
    if (!announcement.targetCampusId) return false;

    const [recipient] = await db
      .select({ id: staff.id })
      .from(staff)
      .where(and(
        eq(staff.id, session.userId),
        eq(staff.institutionId, announcement.institutionId),
        eq(staff.campusId, announcement.targetCampusId)
      ))
      .limit(1);

    return Boolean(recipient);
  }

  if (announcement.targetType === "CLASS") {
    if (!announcement.targetClassId) return false;

    const [recipient] = await db
      .select({ id: staffAssignments.id })
      .from(staffAssignments)
      .innerJoin(sections, eq(staffAssignments.sectionId, sections.id))
      .where(and(
        eq(staffAssignments.staffId, session.userId),
        eq(staffAssignments.institutionId, announcement.institutionId),
        eq(sections.institutionId, announcement.institutionId),
        eq(sections.classId, announcement.targetClassId)
      ))
      .limit(1);

    return Boolean(recipient);
  }

  if (announcement.targetType === "SECTION") {
    if (!announcement.targetSectionId) return false;

    const [recipient] = await db
      .select({ id: staffAssignments.id })
      .from(staffAssignments)
      .where(and(
        eq(staffAssignments.staffId, session.userId),
        eq(staffAssignments.institutionId, announcement.institutionId),
        eq(staffAssignments.sectionId, announcement.targetSectionId)
      ))
      .limit(1);

    return Boolean(recipient);
  }

  return false;
}

function canViewSentOrManagedAnnouncement(announcement: AnnouncementRow, session: JWTPayload) {
  if (announcement.senderRole === session.role && announcement.senderId === session.userId) return true;
  return ["INSTITUTION", "INSTITUTION_ADMIN"].includes(session.role) && announcement.institutionId === getSessionInstitutionId(session);
}

function toVisibleAnnouncement(announcement: AnnouncementRow, isRead: boolean): VisibleAnnouncement {
  return {
    id: announcement.id,
    title: announcement.title,
    content: announcement.content,
    targetType: announcement.targetType,
    senderRole: announcement.senderRole,
    createdAtIso: announcement.createdAt.toISOString(),
    isRead,
    responsePolicy: announcement.responsePolicy ?? {},
  };
}

export async function getVisibleAnnouncements(
  session: JWTPayload,
  limit = 4,
  studentInfo?: { campusId: number | null; classId: number; sectionId: number; createdAt: Date },
  options?: { includeReadStatus?: boolean; forceRefresh?: boolean; studentId?: number }
): Promise<VisibleAnnouncement[]> {
  const institutionId = getSessionInstitutionId(session);
  if (!institutionId) return [];
  if (session.role === 'PARENT') {
    const context=await getParentPortalContext(session,options?.studentId,{selectedOnly:true});
    const child=context.selectedChild;if(!child)return [];
    const rows=await getVisibleAnnouncements({...session,role:'STUDENT',userId:child.id},limit,child,{includeReadStatus:false,forceRefresh:options?.forceRefresh});
    if(!rows.length)return [];
    const receipts=await db.select().from(announcementReads).where(and(eq(announcementReads.userRole,'PARENT'),eq(announcementReads.userId,session.userId),inArray(announcementReads.announcementId,rows.map(row=>row.id))));
    return rows.map(row=>{const read=receipts.find(item=>item.announcementId===row.id);const answer=read?.response.children?.[child.id];return {...row,isRead:Boolean(read),response:answer?{...answer,studentId:child.id}:undefined};});
  }

  let visibleRows: AnnouncementRow[] = [];
  // A dashboard preview and a notices page have different result limits.
  const cacheKey = `cache:announcements:visible:${institutionId}:${session.role}:${session.userId}:${limit}`;

  visibleRows = await getCachedOrFetch(cacheKey, 180, async () => {
    let rows: AnnouncementRow[] = [];
    if (session.role === "INSTITUTION" || session.role === "INSTITUTION_ADMIN") {
      rows = await db.select()
        .from(announcements)
        .where(eq(announcements.institutionId, institutionId))
        .orderBy(desc(announcements.createdAt))
        .limit(limit);
    } else if (session.role === "STUDENT") {
      const student = studentInfo ?? (await db.select({
        campusId: students.campusId,
        classId: students.classId,
        sectionId: students.sectionId,
        createdAt: students.createdAt,
      }).from(students).where(and(eq(students.id, session.userId), eq(students.institutionId, institutionId))).limit(1))[0];

      if (!student) return [];

      rows = await db.select()
        .from(announcements)
        .where(and(
          eq(announcements.institutionId, institutionId),
          gte(announcements.createdAt, student.createdAt),
          or(
            eq(announcements.targetType, "ALL"),
            student.campusId ? and(eq(announcements.targetType, "CAMPUS"), eq(announcements.targetCampusId, student.campusId)) : undefined,
            and(eq(announcements.targetType, "CLASS"), eq(announcements.targetClassId, student.classId)),
            and(eq(announcements.targetType, "SECTION"), eq(announcements.targetSectionId, student.sectionId)),
            and(
              eq(announcements.targetType, "USER"),
              eq(announcements.targetUserRole, "STUDENT"),
              or(eq(announcements.targetUserId, session.userId), isNull(announcements.targetUserId))
            )
          )
        ))
        .orderBy(desc(announcements.createdAt))
        .limit(limit);
    } else if (session.role === "STAFF") {
      // Keep recipient membership fresh in the same SQL statement instead of
      // acquiring three pool clients to build an in-memory scope list.
      rows = await db.select()
        .from(announcements)
        .where(and(
          eq(announcements.institutionId, institutionId),
          sql`exists (select 1 from ${staff} where ${staff.id} = ${session.userId}
            and ${staff.institutionId} = ${institutionId} and ${announcements.createdAt} >= ${staff.createdAt})`,
          eq(announcements.senderRole, "INSTITUTION"),
          or(
            eq(announcements.targetType, "ALL"),
            and(eq(announcements.targetType, "CAMPUS"), sql`exists (select 1 from ${staff}
              where ${staff.id} = ${session.userId} and ${staff.institutionId} = ${institutionId}
              and ${staff.campusId} = ${announcements.targetCampusId})`),
            and(eq(announcements.targetType, "CLASS"), sql`exists (select 1 from ${staffAssignments}
              inner join ${sections} on ${staffAssignments.sectionId} = ${sections.id}
              where ${staffAssignments.staffId} = ${session.userId} and ${staffAssignments.institutionId} = ${institutionId}
              and ${sections.classId} = ${announcements.targetClassId})`),
            and(eq(announcements.targetType, "SECTION"), sql`exists (select 1 from ${staffAssignments}
              where ${staffAssignments.staffId} = ${session.userId} and ${staffAssignments.institutionId} = ${institutionId}
              and ${staffAssignments.sectionId} = ${announcements.targetSectionId})`),
            and(
              eq(announcements.targetType, "USER"),
              eq(announcements.targetUserRole, "STAFF"),
              or(eq(announcements.targetUserId, session.userId), isNull(announcements.targetUserId))
            )
          )
        ))
        .orderBy(desc(announcements.createdAt))
        .limit(limit);
    }
    return rows;
  }, JSON.parse, options?.forceRefresh === true);

  // Re-parse createdAt to Date objects since JSON stringifies them
  visibleRows = visibleRows.map(row => ({
    ...row,
    createdAt: new Date(row.createdAt),
  }));

  if (visibleRows.length === 0) return [];

  if (options?.includeReadStatus === false) {
    return visibleRows.map((announcement) => toVisibleAnnouncement(announcement, false));
  }

  const readRows = await db.select()
    .from(announcementReads)
    .where(
      and(
        eq(announcementReads.userRole, session.role),
        eq(announcementReads.userId, session.userId),
        inArray(announcementReads.announcementId, visibleRows.map((announcement) => announcement.id))
      )
    );

  const readIds = new Set(readRows.map((row) => row.announcementId));
  return visibleRows.map((announcement) => toVisibleAnnouncement(announcement, readIds.has(announcement.id)));
}

export async function getVisibleAnnouncementById(session: JWTPayload, id: number, studentId?: number): Promise<VisibleAnnouncement | null> {
  const institutionId = getSessionInstitutionId(session);
  if (!institutionId) return null;
  if(session.role==='PARENT'){
    const context=await getParentPortalContext(session,studentId,{selectedOnly:Boolean(studentId)});
    for(const child of context.children){
      const visible=await getVisibleAnnouncementById({...session,role:'STUDENT',userId:child.id},id);
      if(!visible)continue;
      const [read]=await db.select().from(announcementReads).where(and(eq(announcementReads.announcementId,id),eq(announcementReads.userRole,'PARENT'),eq(announcementReads.userId,session.userId))).limit(1);
      return {...visible,isRead:Boolean(read),response:{...read?.response.children?.[child.id],studentId:child.id}};
    }
    return null;
  }

  const userCreatedAt = await getUserCreatedAt(session);

  const [announcement] = await db
    .select()
    .from(announcements)
    .where(
      and(
        eq(announcements.id, id), 
        eq(announcements.institutionId, institutionId),
        gte(announcements.createdAt, userCreatedAt)
      )
    )
    .limit(1);

  if (!announcement) return null;

  const isRecipient = await isAnnouncementRecipient(announcement, session);
  const canViewSent = canViewSentOrManagedAnnouncement(announcement, session);
  if (!isRecipient && !canViewSent) return null;

  if (!isRecipient) return toVisibleAnnouncement(announcement, true);

  const [read] = await db.select()
    .from(announcementReads)
    .where(and(eq(announcementReads.announcementId, id), eq(announcementReads.userRole, session.role), eq(announcementReads.userId, session.userId)))
    .limit(1);

  return {...toVisibleAnnouncement(announcement, Boolean(read)),response:read?.response};
}

export async function markAnnouncementRead(session: JWTPayload, id: number, input: unknown = {}) {
  const institutionId = getSessionInstitutionId(session);
  if (!institutionId) throw new Error("Announcement not found");

  const [announcement] = await db
    .select()
    .from(announcements)
    .where(and(eq(announcements.id, id), eq(announcements.institutionId, institutionId)))
    .limit(1);

  if (!announcement) throw new Error("Announcement not found");

  const value=z.object({answer:z.enum(['ACKNOWLEDGED','YES','NO']).optional(),studentId:z.number().int().positive().optional()}).parse(input);
  if(session.mustChangePassword || session.campusReadOnly) throw new ActionInputError('Forbidden');
  const isRecipient = await isAnnouncementRecipient(announcement, session,value.studentId);
  if (!isRecipient) {
    if (canViewSentOrManagedAnnouncement(announcement, session)) return;
    throw new Error("Announcement not found");
  }

  await db.transaction(async tx=>{
    const locked=await tx.select({id:announcements.id}).from(announcements).where(eq(announcements.id,id)).for('update');
    if(!locked.length)throw new ActionInputError('Notice not found.');
    if(session.role==='PARENT'&&value.studentId){const link=await tx.select({id:parentStudents.id}).from(parentStudents).where(and(eq(parentStudents.parentId,session.userId),eq(parentStudents.studentId,value.studentId),eq(parentStudents.institutionId,institutionId))).for('update');if(!link.length)throw new ActionInputError('Child not found.');}
    const [existing]=await tx.select().from(announcementReads).where(and(eq(announcementReads.announcementId,id),eq(announcementReads.userRole,session.role),eq(announcementReads.userId,session.userId))).limit(1);
    const response:AnnouncementResponse={...existing?.response};
    if(value.answer){
      const mode=announcement.responsePolicy.mode;
      if((mode==='ACKNOWLEDGE'&&value.answer!=='ACKNOWLEDGED') || (mode==='CONSENT'&&(session.role!=='PARENT'||!['YES','NO'].includes(value.answer))) || !mode || mode==='NONE')throw new ActionInputError('Choose a valid response for this notice.');
      if(session.role==='PARENT'&&!value.studentId)throw new ActionInputError('Choose the child this response applies to.');
      if(announcement.responsePolicy.dueDate&&announcement.responsePolicy.dueDate<pakistanDateKey())throw new ActionInputError('The response deadline passed. Contact the institution.');
      const previous=session.role==='PARENT'?response.children?.[value.studentId!]?.answer:response.answer;
      if(previous&&previous!==value.answer)throw Object.assign(new ActionInputError('A response was already recorded. Contact the institution to request a new consent notice.'),{status:409});
      const answer={answer:value.answer,at:new Date().toISOString()};
      if(session.role==='PARENT')response.children={...response.children,[value.studentId!]:response.children?.[value.studentId!]??answer};
      else if(!previous)Object.assign(response,answer);
      if(!previous)await tx.insert(auditLogs).values({institutionId,actorRole:session.role,actorId:session.userId,action:'NOTICE_RESPONSE',target:`Announcement:${id}:${value.studentId??0}:${value.answer}`,ip:'server'});
    }
    if(existing)await tx.update(announcementReads).set({response}).where(eq(announcementReads.id,existing.id));
    else await tx.insert(announcementReads).values({announcementId:id,userRole:session.role,userId:session.userId,response});
  });
}

/** Response records must survive ordinary notice removal. Serializes with responding. */
export async function deleteInstitutionAnnouncement(session: JWTPayload, id: number) {
  if(!session.institutionId||!['INSTITUTION','INSTITUTION_ADMIN'].includes(session.role)||session.mustChangePassword||session.campusReadOnly)throw new ActionInputError('Forbidden');
  const institutionId=session.institutionId;
  await db.transaction(async tx=>{
    const [notice]=await tx.select({id:announcements.id}).from(announcements).where(and(eq(announcements.id,id),eq(announcements.institutionId,institutionId))).for('update');
    if(!notice)throw new ActionInputError('Notice not found.');
    const responses=await tx.select({id:announcementReads.id}).from(announcementReads).where(and(eq(announcementReads.announcementId,id),sql`${announcementReads.response} <> '{}'::jsonb`)).limit(1);
    if(responses.length)throw new ActionInputError('This notice has recorded responses and must be kept for your records.');
    await tx.execute(sql`DELETE FROM notifications WHERE institution_id=${institutionId} AND reference_id=${id} AND type IN ('ANNOUNCEMENT','EXAM_TIMETABLE')`);
    await tx.delete(announcements).where(eq(announcements.id,id));
  });
  await invalidateAnnouncementReadCaches(institutionId);
}

export async function getAnnouncementReceipts(session: JWTPayload, id: number) {
  if(!session.institutionId||!['INSTITUTION','INSTITUTION_ADMIN'].includes(session.role))throw new ActionInputError('Forbidden');
  const [notice]=await db.select().from(announcements).where(and(eq(announcements.id,id),eq(announcements.institutionId,session.institutionId))).limit(1);
  if(!notice)throw new ActionInputError('Notice not found.');
  const recipients=await resolveAnnouncementRecipients(notice),studentIds=recipients.filter(row=>row.userRole==='STUDENT').map(row=>row.userId);
  const parents=studentIds.length?await db.select({parentId:parentAccounts.id,name:parentAccounts.email,studentId:students.id,student:students.name}).from(parentStudents)
    .innerJoin(parentAccounts,and(eq(parentAccounts.id,parentStudents.parentId),eq(parentAccounts.institutionId,session.institutionId),eq(parentAccounts.status,'ACTIVE'),isNull(parentAccounts.deletedAt)))
    .innerJoin(students,and(eq(students.id,parentStudents.studentId),isNull(students.deletedAt)))
    .where(and(eq(parentStudents.institutionId,session.institutionId),inArray(parentStudents.studentId,studentIds))):[];
  const reads=await db.select().from(announcementReads).where(eq(announcementReads.announcementId,id));
  const parentReads=new Map(reads.filter(row=>row.userRole==='PARENT').map(row=>[row.userId,row]));
  return {notice:{id:notice.id,title:notice.title,responsePolicy:notice.responsePolicy},studentRecipients:studentIds.length,studentReads:reads.filter(row=>row.userRole==='STUDENT'&&studentIds.includes(row.userId)).length,
    parents:parents.map(parent=>{const read=parentReads.get(parent.parentId);return {...parent,readAt:read?.readAt??null,response:read?.response.children?.[parent.studentId]??null};})};
}
