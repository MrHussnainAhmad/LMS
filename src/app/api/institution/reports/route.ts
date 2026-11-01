import { NextRequest, NextResponse } from 'next/server';
import { sql } from 'drizzle-orm';
import { db } from '@/db';
import { getTenantContext, requireRole } from '@/lib/rbac';
import { getInstitutionAcademicsData } from '@/lib/institution-academics-data';
import { effectiveFeeDueDate, effectiveFeeOverdueAmount } from '@/lib/fee-billing';
import { pakistanDateKey } from '@/lib/parent-period';
import { csvCell } from '@/lib/csv';
import { ActionInputError } from '@/lib/action-input-error';
import { z } from 'zod';

const reports={
  STUDENTS:{label:'Student directory',columns:{studentId:'Student ID',loginId:'Login ID',name:'Student',roll:'Class roll',className:'Class',sectionName:'Section',guardianEmail:'Guardian email',status:'Academic status'}},
  FEES:{label:'Fee balances and follow-up',columns:{invoiceId:'Invoice',studentId:'Student ID',name:'Student',loginId:'Login ID',className:'Class at issue',sectionName:'Section at issue',month:'Billing month',dueDate:'Next due date',total:'Invoice total',paid:'Paid',balance:'Outstanding',overdue:'Overdue now',status:'Payment status',nextDate:'Next contact',note:'Latest follow-up'}},
  ATTENDANCE:{label:'Student attendance',columns:{studentId:'Student ID',name:'Student',loginId:'Login ID',className:'Class',sectionName:'Section',date:'Date',status:'Attendance',markedBy:'Marked by'}},
  RESULTS:{label:'Published assessment marks',columns:{studentId:'Student ID',name:'Student',loginId:'Login ID',className:'Class',sectionName:'Section',date:'Assessment date',title:'Assessment',subject:'Subject',marks:'Marks',maximum:'Maximum',percentage:'Percentage',status:'Result status'}},
  SUPPORT:{label:'Student support',columns:{studentId:'Student ID',name:'Student',loginId:'Login ID',className:'Class',sectionName:'Section',absences:'Absences',recentAverage:'Current assessment average',previousAverage:'Previous assessment average',decline:'Decline (points)',balance:'Outstanding fees',overdue:'Overdue now',status:'Follow-up state',owner:'Assigned to',nextDate:'Next follow-up',note:'Latest note'}},
} as const;
type Dataset=keyof typeof reports;
export const GET=requireRole(['INSTITUTION','INSTITUTION_ADMIN'],async(req:NextRequest,{session})=>{
  const institutionId=getTenantContext(session),params=req.nextUrl.searchParams;
  if(params.get('view')==='metadata'){
    const academics=await getInstitutionAcademicsData(institutionId);
    const staff=await db.execute(sql`SELECT id,name FROM staff WHERE institution_id=${institutionId} AND is_active AND deleted_at IS NULL ORDER BY name`);
    return NextResponse.json({datasets:Object.entries(reports).map(([id,report])=>({id,label:report.label,columns:Object.entries(report.columns).map(([key,label])=>({key,label}))})),classes:academics.classes,sections:academics.sections,staff:staff.rows},{headers:{'Cache-Control':'private, no-store'}});
  }
  const dataset=z.enum(['STUDENTS','FEES','ATTENDANCE','RESULTS','SUPPORT']).parse(params.get('dataset')??'STUDENTS') as Dataset;
  const to=z.string().date().parse(params.get('to')??pakistanDateKey());
  const from=z.string().date().parse(params.get('from')??new Date(new Date(to+'T12:00:00Z').getTime()-29*86400000).toISOString().slice(0,10));
  const days=Math.round((new Date(to).getTime()-new Date(from).getTime())/86400000)+1;
  if(days<1||days>366)throw new ActionInputError('Choose a report period of 1 to 366 days.');
  const classId=params.get('classId')?z.coerce.number().int().positive().parse(params.get('classId')):undefined;
  const sectionId=params.get('sectionId')?z.coerce.number().int().positive().parse(params.get('sectionId')):undefined;
  const page=z.coerce.number().int().min(1).max(1000000).parse(params.get('page')??1),size=100;
  const definitions=reports[dataset].columns as Record<string,string>;
  const columns=(params.get('columns')?.split(',')??Object.keys(definitions)).filter(Boolean);
  if(!columns.length||new Set(columns).size!==columns.length||columns.some(key=>!Object.hasOwn(definitions,key)))throw new ActionInputError('Select valid, distinct report columns.');
  const assessment=sql`SELECT 'test:'||m.id AS row_key,m.student_id,t.date AS day,t.title,su.name AS subject,m.marks_obtained AS marks,m.total_marks AS maximum,
      CASE WHEN m.total_marks>0 THEN m.marks_obtained*100.0/m.total_marks ELSE NULL END AS percentage,'MARKED' AS status,t.class_id,t.section_id,tc.name AS class_name,ts.name AS section_name
    FROM marks m JOIN tests t ON t.id=m.test_id JOIN subjects su ON su.id=t.subject_id JOIN classes tc ON tc.id=t.class_id LEFT JOIN sections ts ON ts.id=t.section_id
    WHERE m.institution_id=${institutionId} AND t.institution_id=${institutionId} AND t.results_published_at IS NOT NULL
    UNION ALL SELECT 'exam:'||r.id,r.student_id,e.created_at::date,e.title,su.name,r.marks_obtained,b.max_marks,
      CASE WHEN COALESCE(r.details->>'status','MARKED') IN ('MARKED','ABSENT') AND b.max_marks>0 THEN r.marks_obtained*100.0/b.max_marks ELSE NULL END,COALESCE(r.details->>'status','MARKED'),e.class_id,e.section_id,COALESCE(e.settings->'roster'->(r.student_id::text)->>'className',ec.name),COALESCE(e.settings->'roster'->(r.student_id::text)->>'sectionName',es.name)
    FROM batch_exam_results r JOIN batch_exam_subjects b ON b.id=r.batch_exam_subject_id JOIN batch_exams e ON e.id=b.batch_exam_id JOIN subjects su ON su.id=b.subject_id JOIN classes ec ON ec.id=e.class_id LEFT JOIN sections es ON es.id=e.section_id
    WHERE e.institution_id=${institutionId} AND e.official_published_at IS NOT NULL`;
  let source;
  if(dataset==='FEES')source=sql`SELECT f.id AS "rowKey",f.id AS "invoiceId",s.id AS "studentId",s.name,s.login_roll_number AS "loginId",f.class_id_at_issue AS "classId",f.section_id_at_issue AS "sectionId",
    COALESCE(f.class_name_at_issue,'Not recorded') AS "className",COALESCE(f.section_name_at_issue,'') AS "sectionName",f.billing_month AS month,${effectiveFeeDueDate}::text AS "dueDate",f.total_amount AS total,f.paid_amount AS paid,
    f.total_amount-f.paid_amount AS balance,${effectiveFeeOverdueAmount} AS overdue,f.status,
    f.plan->'followUps'->-1->>'nextDate' AS "nextDate",f.plan->'followUps'->-1->>'note' AS note
    FROM fee_invoices f JOIN students s ON s.id=f.student_id AND s.institution_id=${institutionId} WHERE f.institution_id=${institutionId} AND f.status<>'VOID'`;
  else if(dataset==='ATTENDANCE')source=sql`SELECT a.id AS "rowKey",s.id AS "studentId",s.name,s.login_roll_number AS "loginId",c.id AS "classId",a.section_id AS "sectionId",c.name AS "className",sec.name AS "sectionName",a.date::text AS date,a.status,a.marked_by_name AS "markedBy"
    FROM attendances a JOIN students s ON s.id=a.student_id JOIN sections sec ON sec.id=a.section_id JOIN classes c ON c.id=sec.class_id
    WHERE a.institution_id=${institutionId} AND s.institution_id=${institutionId} AND a.date BETWEEN ${from}::date AND ${to}::date`;
  else if(dataset==='RESULTS')source=sql`WITH scores AS (${assessment}) SELECT p.row_key AS "rowKey",s.id AS "studentId",s.name,s.login_roll_number AS "loginId",p.class_id AS "classId",p.section_id AS "sectionId",p.class_name AS "className",p.section_name AS "sectionName",p.day::text AS date,p.title,p.subject,p.marks,p.maximum,round(p.percentage::numeric,2) AS percentage,p.status
    FROM scores p JOIN students s ON s.id=p.student_id WHERE s.institution_id=${institutionId} AND p.day BETWEEN ${from}::date AND ${to}::date`;
  else if(dataset==='SUPPORT')source=sql`WITH scores AS (${assessment}) SELECT s.id AS "rowKey",s.id AS "studentId",s.name,s.login_roll_number AS "loginId",s.class_id AS "classId",s.section_id AS "sectionId",c.name AS "className",sec.name AS "sectionName",
    COALESCE(a.absences,0) AS absences,round(g.recent::numeric,2) AS "recentAverage",round(g.previous::numeric,2) AS "previousAverage",round((g.previous-g.recent)::numeric,2) AS decline,
    COALESCE(f.balance,0) AS balance,COALESCE(f.overdue,0) AS overdue,COALESCE(s.support_record->>'status','OPEN') AS status,owner.name AS owner,
    s.support_record->>'nextDate' AS "nextDate",s.support_record->>'note' AS note,(s.support_record-'history') AS record
    FROM students s JOIN classes c ON c.id=s.class_id JOIN sections sec ON sec.id=s.section_id
    LEFT JOIN staff owner ON owner.id=NULLIF(s.support_record->>'assignedTo','')::integer AND owner.institution_id=${institutionId}
    LEFT JOIN LATERAL (SELECT count(*) FILTER (WHERE status='ABSENT')::int AS absences FROM attendances WHERE student_id=s.id AND institution_id=${institutionId} AND date BETWEEN ${from}::date AND ${to}::date) a ON true
    LEFT JOIN LATERAL (SELECT avg(percentage) FILTER (WHERE day>=${from}::date) AS recent,avg(percentage) FILTER (WHERE day<${from}::date) AS previous FROM scores WHERE student_id=s.id AND day BETWEEN ${from}::date-${days}::int AND ${to}::date) g ON true
    LEFT JOIN LATERAL (SELECT sum(total_amount-paid_amount) AS balance,sum(${effectiveFeeOverdueAmount}) AS overdue FROM fee_invoices WHERE student_id=s.id AND institution_id=${institutionId} AND status IN ('DUE','PARTIAL')) f ON true
    WHERE s.institution_id=${institutionId} AND s.is_active AND s.academic_status='ACTIVE' AND s.deleted_at IS NULL`;
  else source=sql`SELECT s.id AS "rowKey",s.id AS "studentId",s.name,s.login_roll_number AS "loginId",s.class_roll_number AS roll,s.class_id AS "classId",s.section_id AS "sectionId",c.name AS "className",sec.name AS "sectionName",s.guardian_email AS "guardianEmail",s.academic_status AS status
    FROM students s JOIN classes c ON c.id=s.class_id JOIN sections sec ON sec.id=s.section_id WHERE s.institution_id=${institutionId} AND s.deleted_at IS NULL`;
  const filters=[sql`true`];
  if(classId)filters.push(sql`r."classId"=${classId}`);
  if(sectionId)filters.push(sql`r."sectionId"=${sectionId}`);
  const query=(params.get('q')??'').trim().slice(0,80);
  if(query)filters.push(sql`(position(lower(${query}) in lower(r.name))>0 OR position(lower(${query}) in lower(r."loginId"))>0)`);
  if(dataset==='SUPPORT'){
    const risk=z.enum(['ALL','ABSENCES','MARKS','FEES']).parse(params.get('risk')??'ALL');
    const status=z.enum(['ALL','ACTIVE','OPEN','MONITORING','RESOLVED']).parse(params.get('status')??'ALL');
    if(status==='ACTIVE')filters.push(sql`r.status IN ('OPEN','MONITORING')`);else if(status!=='ALL')filters.push(sql`r.status=${status}`);
    if(risk==='ABSENCES')filters.push(sql`r.absences>=3`);else if(risk==='MARKS')filters.push(sql`r.decline>=10`);else if(risk==='FEES')filters.push(sql`r.overdue>0`);else filters.push(sql`(r.absences>=3 OR r.decline>=10 OR r.overdue>0)`);
  }
  if(dataset==='FEES'&&params.get('overdue')==='1')filters.push(sql`r.overdue>0`);
  const where=sql.join(filters,sql` AND `);
  const totals=await db.execute<{total:number}>(sql`SELECT count(*)::int AS total FROM (${source}) r WHERE ${where}`);
  const total=totals.rows[0]?.total??0;
  const exportCsv=params.get('format')==='csv';
  if(exportCsv&&total>10000)throw new ActionInputError('This export exceeds 10,000 rows. Narrow the filters before exporting.');
  const projection=columns.map(key=>sql`r.${sql.identifier(key)}`);
  if(dataset==='SUPPORT'&&!exportCsv)projection.push(sql`r."studentId" AS "_id"`,sql`r.record AS "_support"`);
  const result=await db.execute<Record<string,unknown>>(sql`SELECT ${sql.join(projection,sql`, `)} FROM (${source}) r WHERE ${where} ORDER BY r."studentId",r."rowKey" LIMIT ${exportCsv?10000:size} OFFSET ${exportCsv?0:(page-1)*size}`);
  if(exportCsv)return new Response([columns.map(key=>csvCell(definitions[key])).join(','),...result.rows.map(row=>columns.map(key=>csvCell(row[key])).join(','))].join('\n'),{headers:{'Content-Type':'text/csv; charset=utf-8','Content-Disposition':`attachment; filename="institution-${dataset.toLowerCase()}.csv"`,'Cache-Control':'private, no-store'}});
  return NextResponse.json({dataset,columns:columns.map(key=>({key,label:definitions[key]})),rows:result.rows,total,page,pages:Math.max(1,Math.ceil(total/size)),from,to},{headers:{'Cache-Control':'private, no-store'}});
});
