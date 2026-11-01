import { getOrCreateWholeClassSection } from './student-login-institution';
import { and, eq, isNull, sql, type SQLWrapper } from 'drizzle-orm';
import { db } from '@/db';
import { auditLogs, staffAssignments, staff, subjects, sections, classes, leaveRequests } from '@/db/schema';
import type { JWTPayload } from './auth-types';
import { ActionInputError } from './action-input-error';
import { pakistanDateKey } from './parent-period';
import { invalidateTimetableReadCaches } from './redis';
import { z } from 'zod';

export function effectiveTeachingStaffId(date:string|SQLWrapper){
  return sql<number|null>`COALESCE(NULLIF(${staffAssignments.coverage}->${date}->>'staffId','')::integer,${staffAssignments.staffId})`;
}

export async function getStaffWorkload(institutionId:number,date=pakistanDateKey()){
  z.string().date().parse(date);
  const [teachers,slots,leave,conflicts]=await Promise.all([
    db.select({id:staff.id,name:staff.name}).from(staff).where(and(eq(staff.institutionId,institutionId),eq(staff.isActive,true),isNull(staff.deletedAt))).orderBy(staff.name),
    db.select({id:staffAssignments.id,day:staffAssignments.dayOfWeek,start:staffAssignments.startTime,end:staffAssignments.endTime,isBreak:staffAssignments.isBreak,
      primaryStaffId:staffAssignments.staffId,effectiveStaffId:effectiveTeachingStaffId(date),teacher:staff.name,subject:subjects.name,className:classes.name,sectionName:sections.name,sectionId:sections.id,coverage:staffAssignments.coverage,
      minutes:sql<number>`extract(epoch FROM (${staffAssignments.endTime}-${staffAssignments.startTime}))/60`.mapWith(Number),
    }).from(staffAssignments).leftJoin(subjects,eq(subjects.id,staffAssignments.subjectId)).leftJoin(sections,eq(sections.id,staffAssignments.sectionId)).leftJoin(classes,eq(classes.id,sections.classId))
      .leftJoin(staff,eq(staff.id,effectiveTeachingStaffId(date))).where(eq(staffAssignments.institutionId,institutionId)).orderBy(staffAssignments.dayOfWeek,staffAssignments.startTime),
    db.select({staffId:leaveRequests.userId}).from(leaveRequests).where(and(eq(leaveRequests.institutionId,institutionId),eq(leaveRequests.userRole,'STAFF'),eq(leaveRequests.status,'APPROVED'),sql`${leaveRequests.startDate}<=${date} AND ${leaveRequests.endDate}>=${date}`)),
    db.execute<{firstId:number;secondId:number}>(sql`SELECT a.id AS "firstId",b.id AS "secondId" FROM staff_assignments a JOIN staff_assignments b ON a.id<b.id AND a.institution_id=b.institution_id
      AND a.day_of_week=b.day_of_week AND a.start_time<b.end_time AND a.end_time>b.start_time
      WHERE a.institution_id=${institutionId} AND (a.section_id=b.section_id OR (NOT a.is_break AND NOT b.is_break AND
      COALESCE(NULLIF(a.coverage->${date}->>'staffId','')::integer,a.staff_id)=COALESCE(NULLIF(b.coverage->${date}->>'staffId','')::integer,b.staff_id))) ORDER BY a.id,b.id LIMIT 200`),
  ]);
  const onLeave=new Set(leave.map(row=>row.staffId)),available=new Set(teachers.map(row=>row.id)),day=new Date(date+'T12:00:00Z').getUTCDay();
  return {date,day,staff:teachers.map(teacher=>{const own=slots.filter(slot=>!slot.isBreak&&slot.primaryStaffId===teacher.id);return {...teacher,periods:own.length,minutes:own.reduce((sum,row)=>sum+row.minutes,0),sections:new Set(own.map(row=>row.sectionId)).size,onLeave:onLeave.has(teacher.id),coverPeriods:slots.filter(row=>!row.isBreak&&row.day===day&&row.effectiveStaffId===teacher.id&&row.primaryStaffId!==teacher.id).length};}),
    slots:slots.filter(row=>!row.isBreak).map(({coverage,...row})=>({...row,cover:coverage[date]??null,needsCover:row.day===day&&(!row.effectiveStaffId||!available.has(row.effectiveStaffId)||onLeave.has(row.effectiveStaffId))})),conflicts:conflicts.rows};
}

export async function saveTeachingCoverage(session:JWTPayload,input:unknown){
  if(!session.institutionId||!['INSTITUTION','INSTITUTION_ADMIN'].includes(session.role)||session.campusReadOnly||session.mustChangePassword)throw new ActionInputError('Forbidden');
  const value=z.object({assignmentId:z.number().int().positive(),date:z.string().date(),staffId:z.number().int().positive().nullable(),revision:z.number().int().min(0),reason:z.string().trim().min(2).max(500)}).parse(input);
  if(value.date<pakistanDateKey())throw new ActionInputError('Choose today or a future teaching-cover date.');
  const institutionId=session.institutionId;
  const result=await db.transaction(async tx=>{
    await tx.execute(sql`SELECT pg_advisory_xact_lock(80429,${institutionId})`);
    const [slot]=await tx.select().from(staffAssignments).where(and(eq(staffAssignments.id,value.assignmentId),eq(staffAssignments.institutionId,institutionId))).for('update').limit(1);
    if(!slot||slot.isBreak)throw new ActionInputError('Teaching period not found.');
    if(new Date(value.date+'T12:00:00Z').getUTCDay()!==slot.dayOfWeek)throw new ActionInputError('The cover date must match this period weekday.');
    const previous=slot.coverage[value.date];
    if((previous?.revision??0)!==value.revision)throw Object.assign(new ActionInputError('Teaching cover changed. Reload the plan before saving.'),{status:409});
    const effectiveId=value.staffId??slot.staffId;
    if(effectiveId){
      const [teacher]=await tx.select({id:staff.id}).from(staff).where(and(eq(staff.id,effectiveId),eq(staff.institutionId,institutionId),eq(staff.isActive,true),isNull(staff.deletedAt))).limit(1);
      if(!teacher)throw new ActionInputError('Choose an active staff member from this institution.');
      const leave=await tx.select({id:leaveRequests.id}).from(leaveRequests).where(and(eq(leaveRequests.institutionId,institutionId),eq(leaveRequests.userRole,'STAFF'),eq(leaveRequests.userId,effectiveId),eq(leaveRequests.status,'APPROVED'),sql`${leaveRequests.startDate}<=${value.date} AND ${leaveRequests.endDate}>=${value.date}`)).limit(1);
      if(value.staffId!==null&&leave.length)throw new ActionInputError('This teacher has approved leave on the selected date.');
      const conflicts=await tx.select({id:staffAssignments.id}).from(staffAssignments).where(and(eq(staffAssignments.institutionId,institutionId),eq(staffAssignments.dayOfWeek,slot.dayOfWeek),eq(staffAssignments.isBreak,false),
        eq(effectiveTeachingStaffId(value.date),effectiveId),sql`${staffAssignments.id}<>${slot.id} AND ${staffAssignments.startTime}<${slot.endTime} AND ${staffAssignments.endTime}>${slot.startTime}`)).limit(1);
      if(conflicts.length)throw Object.assign(new ActionInputError('This teacher already has an overlapping period on the cover date.'),{status:409});
    }
    const at=new Date().toISOString();
    const coverage={...slot.coverage,[value.date]:{staffId:value.staffId,reason:value.reason,assignedBy:session.userId,at,revision:value.revision+1,history:[...(previous?.history??[]),...(previous?[{staffId:previous.staffId,reason:previous.reason,assignedBy:previous.assignedBy,at:previous.at}]:[])]}};
    await tx.update(staffAssignments).set({coverage}).where(eq(staffAssignments.id,slot.id));
    await tx.insert(auditLogs).values({institutionId,actorId:session.userId,actorRole:session.role,action:'TEACHING_COVER_UPDATED',target:`Timetable:${slot.id}:${value.date}:${value.staffId??'primary'}`,ip:'server'});
    return {sectionId:slot.sectionId,staffId:slot.staffId,previousStaffId:previous?.staffId};
  });
  await Promise.all([...new Set([result.staffId,result.previousStaffId,value.staffId])].map(id=>invalidateTimetableReadCaches(institutionId,result.sectionId,id??null)));
  return {success:true};
}

/** Shared timetable creation for the form action and HTTP route. */
export async function createTimetableAssignment(session:JWTPayload,input:unknown){
  if(!session.institutionId||!['INSTITUTION','INSTITUTION_ADMIN'].includes(session.role)||session.campusReadOnly||session.mustChangePassword)throw new ActionInputError('Forbidden');
  const value=z.object({sectionId:z.coerce.number().int().positive().nullable().optional(),classId:z.coerce.number().int().positive().nullable().optional(),
    dayOfWeek:z.coerce.number().int().min(1).max(6),startTime:z.string().regex(/^([01][0-9]|2[0-3]):[0-5][0-9](?::[0-5][0-9])?$/),endTime:z.string().regex(/^([01][0-9]|2[0-3]):[0-5][0-9](?::[0-5][0-9])?$/),
    isBreak:z.boolean().default(false),staffId:z.coerce.number().int().positive().nullable().optional(),subjectId:z.coerce.number().int().positive().nullable().optional()}).parse(input);
  const start=value.startTime.length===5?value.startTime+':00':value.startTime,end=value.endTime.length===5?value.endTime+':00':value.endTime;
  if(start>=end||(!value.sectionId&&!value.classId)||(!value.isBreak&&(!value.staffId||!value.subjectId)))throw new ActionInputError('Select a class/section, valid times, and a subject teacher.');
  const institutionId=session.institutionId;
  const created=await db.transaction(async tx=>{
    await tx.execute(sql`SELECT pg_advisory_xact_lock(80429,${institutionId})`);
    const sectionId=value.sectionId??(await getOrCreateWholeClassSection(institutionId,value.classId!,tx)).id;
    const [section]=await tx.select({id:sections.id}).from(sections).where(and(eq(sections.id,sectionId),eq(sections.institutionId,institutionId),isNull(sections.deletedAt),value.classId?eq(sections.classId,value.classId):undefined)).limit(1);
    if(!section)throw new ActionInputError('Section not found.');
    if(!value.isBreak){
      const [teacher]=await tx.select({id:staff.id}).from(staff).where(and(eq(staff.id,value.staffId!),eq(staff.institutionId,institutionId),eq(staff.isActive,true),isNull(staff.deletedAt))).limit(1);
      const [subject]=await tx.select({id:subjects.id}).from(subjects).where(and(eq(subjects.id,value.subjectId!),eq(subjects.institutionId,institutionId),isNull(subjects.deletedAt))).limit(1);
      if(!teacher||!subject)throw new ActionInputError('Select an active teacher and subject from this institution.');
    }
    const overlap=await tx.select({id:staffAssignments.id}).from(staffAssignments).where(and(eq(staffAssignments.institutionId,institutionId),eq(staffAssignments.dayOfWeek,value.dayOfWeek),
      sql`${staffAssignments.startTime}<${end} AND ${staffAssignments.endTime}>${start}`,
      sql`(${staffAssignments.sectionId}=${sectionId} OR (${!value.isBreak} AND (${staffAssignments.staffId}=${value.staffId??null} OR EXISTS
        (SELECT 1 FROM jsonb_each(${staffAssignments.coverage}) cover WHERE cover.key>=${pakistanDateKey()} AND NULLIF(cover.value->>'staffId','')::integer=${value.staffId??null}))))`)).limit(1);
    if(overlap.length)throw Object.assign(new ActionInputError('The section, teacher, or a dated teaching-cover assignment overlaps this period.'),{status:409});
    const [row]=await tx.insert(staffAssignments).values({institutionId,sectionId,dayOfWeek:value.dayOfWeek,startTime:start,endTime:end,isBreak:value.isBreak,staffId:value.isBreak?null:value.staffId,subjectId:value.isBreak?null:value.subjectId}).returning({id:staffAssignments.id});
    return {id:row.id,sectionId,staffId:value.isBreak?null:value.staffId??null};
  });
  await invalidateTimetableReadCaches(institutionId,created.sectionId,created.staffId);
  await (await import('./notification-events')).notifyTimetable(institutionId,created.sectionId,created.staffId,'create:'+created.id);
  return created;
}
