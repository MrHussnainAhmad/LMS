import { sql } from 'drizzle-orm';
import { db } from '@/db';
import { effectiveFeeDueDate } from './fee-billing';
import { createBulkNotificationsImmediately, type NotificationPayload } from './notification-delivery';

/** Time-based events are discovered here and dispatched immediately, never queued. */
export async function sendDueNotificationReminders() {
 const rows=await db.execute(sql`
 SELECT f.institution_id AS "institutionId", f.student_id AS "userId", f.id AS "referenceId",
 'FEE_OVERDUE' AS type, 'Fee overdue' AS title, 'Your fee voucher is overdue. Please review the outstanding balance.' AS message,
 'fee-overdue:'||f.id||':'||${effectiveFeeDueDate} AS "eventKey"
 FROM fee_invoices f JOIN students s ON s.id=f.student_id AND s.institution_id=f.institution_id
 JOIN institutions i ON i.id=f.institution_id
 WHERE f.status IN ('DUE','PARTIAL') AND f.total_amount>f.paid_amount
 AND ${effectiveFeeDueDate} < (clock_timestamp() AT TIME ZONE 'Asia/Karachi')::date
 AND s.is_active AND s.deleted_at IS NULL AND i.status='APPROVED' AND i.deleted_at IS NULL
 AND NOT EXISTS (SELECT 1 FROM notifications n WHERE n.institution_id=f.institution_id AND n.user_role='STUDENT' AND n.user_id=f.student_id AND n.event_key='fee-overdue:'||f.id||':'||${effectiveFeeDueDate})
 ORDER BY f.due_date,f.id LIMIT 500`);
 const assignments=await db.execute(sql`
 SELECT a.institution_id AS "institutionId", s.id AS "userId", a.id AS "referenceId",
 'ASSIGNMENT_REMINDER' AS type, 'Assignment deadline approaching' AS title,
 'Your assignment '||a.title||' is due within 24 hours.' AS message,
 'assignment-reminder:'||a.id||':'||s.id AS "eventKey"
 FROM assignments a JOIN students s ON s.class_id=a.class_id AND s.institution_id=a.institution_id AND (a.section_id IS NULL OR a.section_id=s.section_id)
 JOIN institutions i ON i.id=a.institution_id
 WHERE a.due_at>clock_timestamp() AND a.due_at<=clock_timestamp()+interval '24 hours'
 AND s.is_active AND s.deleted_at IS NULL AND i.status='APPROVED' AND i.deleted_at IS NULL
 AND NOT EXISTS (SELECT 1 FROM submissions sub WHERE sub.assignment_id=a.id AND sub.student_id=s.id AND sub.institution_id=a.institution_id)
 AND NOT EXISTS (SELECT 1 FROM notifications n WHERE n.institution_id=a.institution_id AND n.user_role='STUDENT' AND n.user_id=s.id AND n.event_key='assignment-reminder:'||a.id||':'||s.id)
 ORDER BY a.due_at,a.id,s.id LIMIT 500`);
 const batch=await db.execute(sql`
 SELECT DISTINCT e.institution_id AS "institutionId", r.student_id AS "userId", e.id AS "referenceId",
 'MARKS' AS type, 'Exam results published' AS title, 'New exam results are available.' AS message,
 'batch-result:'||e.id AS "eventKey"
 FROM batch_exam_subjects b JOIN batch_exams e ON e.id=b.batch_exam_id
 JOIN batch_exam_results r ON r.batch_exam_subject_id=b.id
 JOIN students s ON s.id=r.student_id AND s.institution_id=e.institution_id
 JOIN institutions i ON i.id=e.institution_id
 WHERE e.official_published_at IS NOT NULL
 AND e.official_published_at>=(SELECT activated_at FROM notification_rollout WHERE id=true)
 AND NOT EXISTS (SELECT 1 FROM batch_exam_subjects pending WHERE pending.batch_exam_id=e.id AND NOT pending.is_published)
 AND NOT EXISTS (SELECT 1 FROM batch_exam_results hidden JOIN batch_exam_subjects hs ON hs.id=hidden.batch_exam_subject_id WHERE hs.batch_exam_id=e.id AND hidden.student_id=r.student_id AND COALESCE(hidden.details->>'status','MARKED') IN ('WITHHELD','NOT_ENTERED'))
 AND s.is_active AND s.deleted_at IS NULL AND i.status='APPROVED' AND i.deleted_at IS NULL
 AND NOT EXISTS (SELECT 1 FROM notifications n WHERE n.institution_id=e.institution_id AND n.user_role='STUDENT' AND n.user_id=r.student_id AND n.event_key='batch-result:'||e.id)
 ORDER BY "referenceId","userId" LIMIT 500`);
 const payloads=[...rows.rows,...assignments.rows,...batch.rows].map(row=>({...row,userRole:'STUDENT',...(row.type==='MARKS'?{data:{screen:'transcripts'}}:{})})) as NotificationPayload[];
 const inserted=await createBulkNotificationsImmediately(payloads);
 return {events:payloads.length,notifications:inserted.length};
}
