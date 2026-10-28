import { randomUUID } from 'node:crypto';
import { and, eq, inArray, isNull, sql } from 'drizzle-orm';
import { db } from '@/db';
import { students, staffAssignments, tests, marks, assignments, batchExamResults, batchExamSubjects, batchExams, sections } from '@/db/schema';
import { createBulkNotifications, createNotification, type NotificationPayload } from './notification-delivery';
export async function notifyTimetable(institutionId:number,sectionId:number,teacherId?:number|null,eventKey:string=randomUUID()) {
 const roster=await db.select({id:students.id}).from(students).where(and(eq(students.institutionId,institutionId),eq(students.sectionId,sectionId),isNull(students.deletedAt)));
 const teachers=await db.select({id:staffAssignments.staffId}).from(staffAssignments).where(and(eq(staffAssignments.institutionId,institutionId),eq(staffAssignments.sectionId,sectionId)));
 const ids=[...new Set([...teachers.flatMap(t=>t.id?[t.id]:[]),...(teacherId?[teacherId]:[])])];
 await createBulkNotifications([...roster.map(s=>({institutionId,userRole:'STUDENT' as const,userId:s.id,type:'TIMETABLE' as const,title:'Timetable updated',message:'Your class timetable has changed. Open the timetable to review it.',eventKey:`timetable:${eventKey}`})),
 ...ids.map(id=>({institutionId,userRole:'STAFF' as const,userId:id,type:'TIMETABLE' as const,title:'Timetable updated',message:'The timetable for one of your classes has changed.',eventKey:`timetable:${eventKey}`}))]);
}
export async function notifyPublishedResults(institutionId:number,testId:number,studentIds?:number[]) {
 const [test]=await db.select({title:tests.title,published:tests.resultsPublishedAt}).from(tests).where(and(eq(tests.id,testId),eq(tests.institutionId,institutionId))).limit(1);
 if(!test?.published)return;
 const rows=await db.select({id:marks.studentId}).from(marks).where(and(eq(marks.institutionId,institutionId),eq(marks.testId,testId),studentIds?inArray(marks.studentId,studentIds):undefined));
 await createBulkNotifications(rows.map(s=>({institutionId,userRole:'STUDENT' as const,userId:s.id,type:'MARKS' as const,title:'Results published',message:`Results for ${test.title} are now available.`,referenceId:testId,eventKey:`result:${testId}:${test.published!.toISOString()}`})));
}
export async function notifyAssignment(institutionId:number,id:number) {
 const [assignment]=await db.select().from(assignments).where(and(eq(assignments.id,id),eq(assignments.institutionId,institutionId))).limit(1);if(!assignment)return;
 const rows=await db.select({id:students.id}).from(students).where(and(eq(students.institutionId,institutionId),eq(students.classId,assignment.classId),assignment.sectionId?eq(students.sectionId,assignment.sectionId):undefined,isNull(students.deletedAt)));
 await createBulkNotifications(rows.map(s=>({institutionId,userRole:'STUDENT' as const,userId:s.id,type:'ASSIGNMENT' as const,title:'New assignment',message:`${assignment.title} is available.`,referenceId:id,eventKey:`assignment:${id}`})));
}
export async function notifyBatchResults(institutionId:number,subjectId:number) {
 const [subject]=await db.select({published:batchExamSubjects.isPublished,examId:batchExamSubjects.batchExamId}).from(batchExamSubjects).innerJoin(batchExams,eq(batchExams.id,batchExamSubjects.batchExamId)).where(and(eq(batchExamSubjects.id,subjectId),eq(batchExams.institutionId,institutionId))).limit(1);
 if(!subject?.published)return;
 const pending=await db.select({id:batchExamSubjects.id}).from(batchExamSubjects).where(and(eq(batchExamSubjects.batchExamId,subject.examId),eq(batchExamSubjects.isPublished,false),sql`${batchExamSubjects.reviewDeadline}>clock_timestamp()`)).limit(1);
 if(pending.length)return;
 const rows=await db.selectDistinct({studentId:batchExamResults.studentId}).from(batchExamResults).innerJoin(batchExamSubjects,eq(batchExamSubjects.id,batchExamResults.batchExamSubjectId)).where(eq(batchExamSubjects.batchExamId,subject.examId));
 await createBulkNotifications(rows.map(s=>({institutionId,userRole:'STUDENT' as const,userId:s.studentId,type:'MARKS' as const,title:'Exam results published',message:'New exam results are available in your results section.',referenceId:subject.examId,data:{screen:'transcripts'},eventKey:`batch-result:${subject.examId}`})));
}
export async function notifyApprovedStudentLeave(institutionId:number,studentId:number,leaveId:number) {
 const [student]=await db.select({name:students.name,teacherId:sections.classTeacherId}).from(students).innerJoin(sections,and(eq(sections.id,students.sectionId),eq(sections.institutionId,institutionId))).where(and(eq(students.id,studentId),eq(students.institutionId,institutionId))).limit(1);
 if(student?.teacherId)await createNotification({institutionId,userRole:'STAFF',userId:student.teacherId,type:'LEAVE_REQUEST',title:'Student leave approved',message:`Leave for ${student.name} has been approved.`,referenceId:leaveId,eventKey:`approved-leave:${leaveId}`});
}
export async function notifySecurity(payload:Pick<NotificationPayload,'institutionId'|'userRole'|'userId'>,message:string,eventKey:string=randomUUID()) {
 if(!['STUDENT','STAFF','PARENT'].includes(payload.userRole))return;
 await createNotification({...payload,type:'SECURITY',title:'Account security update',message,eventKey:`security:${eventKey}`});
}
