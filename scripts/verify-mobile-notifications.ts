import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { build } from 'esbuild';
import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { NextRequest, NextResponse } from 'next/server';
const require=createRequire(path.resolve('package.json'));
async function main(){
 const memory=await PGlite.create();
 const query=<T=Record<string,unknown>>(text:string,params?:unknown[])=>memory.query<T>(text,params);
 const state={db:drizzle(memory),after:[] as (()=>Promise<void>)[],session:{role:'STUDENT',userId:1,institutionId:1} as {role:string;userId:number;institutionId:number}|null};
 (globalThis as typeof globalThis & {__notificationFixture?:typeof state}).__notificationFixture=state;
 const originalFetch=globalThis.fetch;
 const sends:{to:string;data:Record<string,unknown>}[][]=[];
 let providerFailure=false,unregistered=false;
 globalThis.fetch=async(_url,options)=>{const messages=JSON.parse(String(options?.body));sends.push(messages);return Response.json(providerFailure?{error:'temporary'}:{data:messages.map((_:unknown,i:number)=>unregistered?{status:'error',details:{error:'DeviceNotRegistered'}}:{status:'ok',id:`ticket-${sends.length}-${i}`})},{status:providerFailure?503:200});};
 const mocks:Record<string,string>={
 db:'export const db=globalThis.__notificationFixture.db;',
 'next/server':`export const NextResponse=globalThis.__fixtureNextResponse;export const after=fn=>globalThis.__notificationFixture.after.push(fn);`,
 auth:'export const getSessionFromRequest=async()=>globalThis.__notificationFixture.session;',
 rbac:`export const requireRole=(roles,fn)=>async(req)=>{const session=globalThis.__notificationFixture.session;if(!session||!roles.includes(session.role))return Response.json({error:'Unauthorized'},{status:401});return fn(req,{session});};`,
 user:'export const resolveUserCreatedAt=async()=>new Date(0);',
 redis:`export const invalidateReadCacheKeys=async()=>{};export const redis={status:'end',del:async()=>{},get:async()=>null};export const getRawCachedOrFetch=async(_k,_t,fn)=>fn();export const getCachedOrFetch=getRawCachedOrFetch;`,
 'rate-limit':'export const withRateLimit=async()=>({success:true});',
 announcements:'export const getVisibleAnnouncements=async()=>[];export const resolveAnnouncementRecipients=async()=>[];',
 };
 (globalThis as typeof globalThis & {__fixtureNextResponse?:typeof NextResponse}).__fixtureNextResponse=NextResponse;
 async function load<T>(entry:string):Promise<T>{const result=await build({entryPoints:[entry],bundle:true,write:false,platform:'node',format:'cjs',packages:'external',logLevel:'silent',plugins:[{name:'notification-fixture',setup(b){b.onResolve({filter:/.*/},args=>{if(args.kind==='entry-point')return;const absolute=args.path.startsWith('@/')?path.resolve('src',args.path.slice(2)):args.path.startsWith('.')?path.resolve(args.resolveDir,args.path):'';const key=absolute===path.resolve('src/db')?'db':path.dirname(absolute)===path.resolve('src/lib')?path.basename(absolute).replace(/\.ts$/,''):args.path;if(mocks[key])return{path:key,namespace:'fixture'};});b.onLoad({filter:/.*/,namespace:'fixture'},args=>({contents:mocks[args.path],loader:'js',resolveDir:process.cwd()}));}}]});const fixtureModule={exports:{} as T};new Function('require','module','exports',result.outputFiles[0].text)(require,fixtureModule,fixtureModule.exports);return fixtureModule.exports;}
 let checks=0;const pass=(message:string)=>{checks++;console.log('PASS '+message);};
 const hash=(text:string)=>createHash('sha256').update(text).digest('hex');
 const tokenA='a'.repeat(80),tokenB='b'.repeat(80),tokenP='c'.repeat(80),tokenOther='d'.repeat(80);
 try{
 await memory.exec(`CREATE TYPE user_role AS ENUM ('STUDENT','STAFF','PARENT','INSTITUTION','INSTITUTION_ADMIN','SUPER_ADMIN','EMPLOYEE');
 CREATE TYPE notification_type AS ENUM ('ANNOUNCEMENT','EXAM_TIMETABLE','ASSIGNMENT','TEST','MARKS','ATTENDANCE','GENERAL','LEAVE_REQUEST','DIARY');
 CREATE TABLE institutions(id integer PRIMARY KEY,status text DEFAULT 'APPROVED',deleted_at timestamp,parent_institution_id integer);
 CREATE TABLE sections(id integer PRIMARY KEY,institution_id integer,class_teacher_id integer);
 CREATE TABLE students(id integer PRIMARY KEY,institution_id integer,name text,class_id integer,section_id integer,is_active boolean DEFAULT true,deleted_at timestamp,expo_push_token varchar(255),announcement_push_notifications_enabled boolean DEFAULT true,test_push_notifications_enabled boolean DEFAULT true);
 CREATE TABLE staff(id integer PRIMARY KEY,institution_id integer,name text,is_active boolean DEFAULT true,deleted_at timestamp,expo_push_token varchar(255),announcement_push_notifications_enabled boolean DEFAULT true);
 CREATE TABLE parent_accounts(id integer PRIMARY KEY,institution_id integer,status text DEFAULT 'ACTIVE',password_hash text DEFAULT 'fixture',deleted_at timestamp);
 CREATE TABLE parent_students(id serial PRIMARY KEY,institution_id integer,parent_id integer,student_id integer);
 CREATE TABLE notifications(id serial PRIMARY KEY,institution_id integer,user_role user_role,user_id integer,type notification_type,title varchar(255),message text,is_read boolean DEFAULT false,reference_id integer,created_at timestamp DEFAULT now());
 CREATE TABLE refresh_tokens(id serial PRIMARY KEY,user_role user_role,user_id integer,token_hash text,expires_at timestamp,revoked_at timestamp,qr_session_id varchar(36));
 CREATE TABLE qr_login_sessions(id varchar(36) PRIMARY KEY,revoked_at timestamptz,expires_at timestamptz);
 CREATE TABLE expo_push_tickets(id serial PRIMARY KEY,ticket_id text UNIQUE,token text,user_role user_role,user_id integer,notification_id integer,status text DEFAULT 'PENDING',error text,checked_at timestamp,created_at timestamp DEFAULT now());
 CREATE TABLE fee_invoices(id serial PRIMARY KEY,institution_id integer,student_id integer,due_date date,status text,total_amount integer,paid_amount integer);
 CREATE TABLE assignments(id serial PRIMARY KEY,institution_id integer,class_id integer,section_id integer,title text,due_at timestamp);
 CREATE TABLE submissions(id serial PRIMARY KEY,institution_id integer,student_id integer,assignment_id integer);
 CREATE TABLE batch_exams(id integer PRIMARY KEY,institution_id integer);
 CREATE TABLE batch_exam_subjects(id integer PRIMARY KEY,batch_exam_id integer,is_published boolean,published_at timestamp,review_deadline timestamp);
 CREATE TABLE batch_exam_results(id serial PRIMARY KEY,batch_exam_subject_id integer,student_id integer);
 INSERT INTO institutions(id) VALUES(1),(2);INSERT INTO sections VALUES(1,1,10),(2,2,20);
 INSERT INTO students(id,institution_id,name,class_id,section_id)VALUES(1,1,'Child One',1,1),(2,2,'Foreign Child',2,2),(3,1,'Child Two',1,1);
 INSERT INTO staff(id,institution_id,name)VALUES(10,1,'Teacher'),(20,2,'Other Teacher');
 INSERT INTO parent_accounts(id,institution_id)VALUES(100,1),(200,2);
 INSERT INTO parent_students(institution_id,parent_id,student_id)VALUES(1,100,1),(1,100,3),(2,200,2);`);
 const migration=readFileSync('drizzle/0080_mobile_notifications.sql','utf8');await memory.exec(migration);await memory.exec(migration);await memory.exec(readFileSync('drizzle/0081_institution_mobile_apps.sql','utf8'));
 for(const [role,id,token]of [['STUDENT',1,tokenA],['STUDENT',1,tokenB],['PARENT',100,tokenP],['STUDENT',2,tokenOther]] as const)await query("INSERT INTO refresh_tokens(user_role,user_id,token_hash,expires_at)VALUES($1,$2,$3,now()+interval '30 days')",[role,id,hash(token)]);
 pass('forward migration creates devices, parent preferences, metadata, deduplication and reminder indexes and is idempotent');
 const delivery=await load<typeof import('../src/lib/notification-delivery')>('src/lib/notification-delivery.ts');
 const registration=await load<typeof import('../src/app/api/me/push-token/route')>('src/app/api/me/push-token/route.ts');
 const inbox=await load<{GET(req:NextRequest):Promise<Response>;PATCH(req:NextRequest):Promise<Response>}>('src/app/api/me/notifications/route.ts');
 const project='11111111-1111-4111-8111-111111111111',parentProject='22222222-2222-4222-8222-222222222222';
 const request=(body:object,method='POST')=>new NextRequest('http://localhost:3000/api/me/push-token',{method,headers:{'content-type':'application/json'},body:JSON.stringify(body)});
 assert.equal((await registration.POST(request({token:'bad'}))).status,400);
 assert.equal((await registration.POST(request({token:'ExpoPushToken[student-one]',projectId:project,refreshToken:tokenOther}))).status,403);
 for(const [token,refresh]of [['ExpoPushToken[student-one]',tokenA],['ExpoPushToken[student-two]',tokenB]])assert.equal((await registration.POST(request({token,projectId:project,refreshToken:refresh,deviceName:'Test phone'}))).status,200);
 state.session={role:'PARENT',userId:100,institutionId:1};assert.equal((await registration.POST(request({token:'ExpoPushToken[parent]',projectId:parentProject,refreshToken:tokenP}))).status,200);
 state.after.length=0;sends.length=0;
 pass('Student/Parent registration supports multiple session-bound devices and rejects malformed or foreign-account refresh tokens');
 const dispatch=async()=>{const tasks=state.after.splice(0);await Promise.all(tasks.map(task=>task()));};
 const event={institutionId:1,userRole:'STUDENT' as const,userId:1,type:'DIARY' as const,title:'Diary',message:'New diary',eventKey:'diary:1',referenceId:1};
 const created=await delivery.createBulkNotifications([event]);assert.equal(created.length,2);assert.equal(sends.length,0);await dispatch();
 assert.equal(sends.length,2,'Projects are sent separately');assert.equal(sends.flat().length,3,'Two student devices and linked parent');
 assert.ok(sends.flat().every(message=>message.data.institutionId===1));assert.ok(sends.flat().some(message=>message.data.userRole==='PARENT'&&message.data.studentId===1));
 assert.equal((await delivery.createBulkNotifications([event])).length,0);await dispatch();assert.equal(sends.flat().length,3);
 pass('events immediately dispatch after commit to all devices and linked parents, isolate projects and deduplicate repeated events');
 state.session={role:'PARENT',userId:100,institutionId:1};let response=await inbox.GET(new NextRequest('http://localhost:3000/api/me/notifications'));let data=await response.json();assert.ok(data.notifications.every((row:{userRole?:string;studentId:number|null})=>row.studentId===null||row.studentId===1));
 await query('DELETE FROM parent_students WHERE parent_id=100 AND student_id=1');response=await inbox.GET(new NextRequest('http://localhost:3000/api/me/notifications'));data=await response.json();assert.ok(!data.notifications.some((row:{studentId:number})=>row.studentId===1));
 sends.length=0;await delivery.deliverNotificationIds(created.map(row=>row.id));assert.equal(sends.flat().filter(message=>message.data.userRole==='PARENT').length,0);
 await query('INSERT INTO parent_students(institution_id,parent_id,student_id)VALUES(1,100,1)');
 pass('parent inbox and push recheck child links and remove access immediately after unlinking');
 await query('UPDATE institutions SET apps_enabled=false WHERE id=1');sends.length=0;
 const webOnly=await delivery.createBulkNotificationsImmediately([{...event,eventKey:'apps-disabled'}]);
 assert.equal(sends.length,0);assert.equal(webOnly.length,2,'Web inbox events remain available');
 await query('UPDATE institutions SET apps_enabled=true WHERE id=1');
 pass('Apps disabled stops phone pushes while preserving web inbox records');

 await query('UPDATE students SET announcement_push_notifications_enabled=false WHERE id=1');sends.length=0;
 await delivery.createBulkNotificationsImmediately([{...event,type:'ANNOUNCEMENT',eventKey:'ann:1'}]);assert.ok(sends.flat().every(message=>message.data.userRole==='PARENT'));
 await query('UPDATE students SET announcement_push_notifications_enabled=true WHERE id=1');
 state.session={role:'STUDENT',userId:1,institutionId:1};await registration.DELETE(request({token:'ExpoPushToken[student-one]'},'DELETE'));
 sends.length=0;await delivery.createBulkNotificationsImmediately([{...event,eventKey:'diary:2'}]);assert.equal(sends.flat().filter(message=>message.data.userRole==='STUDENT').length,1);
 await query('UPDATE refresh_tokens SET revoked_at=now() WHERE token_hash=$1',[hash(tokenB)]);sends.length=0;await delivery.createBulkNotificationsImmediately([{...event,eventKey:'diary:3'}]);assert.ok(sends.flat().every(message=>message.data.userRole==='PARENT'));
 pass('preferences, unregister/logout and revoked refresh sessions prevent ordinary pushes without deleting inbox records');
 await query("UPDATE students SET expo_push_token='ExpoPushToken[legacy]' WHERE id=1");sends.length=0;
 await delivery.createBulkNotificationsImmediately([{...event,eventKey:'legacy-live'}]);assert.ok(sends.flat().some(message=>message.to==='ExpoPushToken[legacy]'));
 await registration.DELETE(request({token:'ExpoPushToken[legacy]'},'DELETE'));sends.length=0;
 await delivery.createBulkNotificationsImmediately([{...event,eventKey:'legacy-logout'}]);assert.ok(sends.flat().every(message=>message.to!=='ExpoPushToken[legacy]'));
 pass('legacy installed clients keep receiving pushes and unregister clears their legacy device binding');

 const before=(await query('SELECT count(*)::int AS count FROM notifications')).rows[0].count;
 await assert.rejects(state.db.transaction(async tx=>{await delivery.createBulkNotifications([{...event,eventKey:'rollback'}],tx as unknown as Parameters<typeof delivery.createBulkNotifications>[1]);throw new Error('rollback');}));sends.length=0;await dispatch();assert.equal(sends.length,0);assert.equal((await query('SELECT count(*)::int AS count FROM notifications')).rows[0].count,before);
 pass('rolled-back business transactions never send phantom pushes');
 const teacherToken='e'.repeat(80);
 await query("INSERT INTO refresh_tokens(user_role,user_id,token_hash,expires_at)VALUES('STAFF',10,$1,now()+interval '30 days')",[hash(teacherToken)]);
 state.session={role:'STAFF',userId:10,institutionId:1};assert.equal((await registration.POST(request({token:'ExpoPushToken[teacher]',projectId:project,refreshToken:teacherToken}))).status,200);await dispatch();sends.length=0;
 await memory.exec(`CREATE TABLE staff_assignments(id serial PRIMARY KEY,institution_id integer,section_id integer,staff_id integer);
 CREATE TABLE tests(id integer PRIMARY KEY,institution_id integer,title text,results_published_at timestamp);
 CREATE TABLE marks(id serial PRIMARY KEY,institution_id integer,test_id integer,student_id integer);
 INSERT INTO staff_assignments(institution_id,section_id,staff_id)VALUES(1,1,10);
 INSERT INTO tests VALUES(1,1,'Draft assessment',NULL);INSERT INTO marks(institution_id,test_id,student_id)VALUES(1,1,1);`);
 const events=await load<typeof import('../src/lib/notification-events')>('src/lib/notification-events.ts');
 const beforeDraft=(await query("SELECT count(*)::int AS count FROM notifications WHERE type='MARKS'")).rows[0].count;
 await events.notifyPublishedResults(1,1);assert.equal((await query("SELECT count(*)::int AS count FROM notifications WHERE type='MARKS'")).rows[0].count,beforeDraft);
 await query('UPDATE tests SET results_published_at=now() WHERE id=1');await events.notifyPublishedResults(1,1);await dispatch();
 await events.notifyTimetable(1,1,10,'fixture-change');await dispatch();
 assert.ok(sends.flat().some(message=>message.data.userRole==='STAFF'&&message.data.screen==='timetable'));
 await events.notifyApprovedStudentLeave(1,1,42);await dispatch();
 assert.ok(sends.flat().some(message=>message.data.userRole==='STAFF'&&message.data.screen==='leave'));
 const helpers=await load<typeof import('../src/lib/notifications')>('src/lib/notifications.ts');
 await helpers.createAttendanceNotifications({institutionId:1,date:'2026-10-28',records:[{studentId:1,status:'PRESENT'},{studentId:1,status:'ABSENT'},{studentId:1,status:'LATE'}]});await dispatch();
 const attendanceRows=await query("SELECT user_role FROM notifications WHERE type='ATTENDANCE'");assert.equal(attendanceRows.rows.length,3);assert.ok(attendanceRows.rows.every(row=>row.user_role==='PARENT'));
 pass('real event helpers gate draft results, notify assigned teachers of timetable/approved leave, and send Present/Absent/Late attendance only to linked parents');
 await memory.exec("INSERT INTO batch_exams VALUES(1,1);INSERT INTO batch_exam_subjects VALUES(1,1,true,now(),now()+interval '1 hour'),(2,1,false,NULL,now()+interval '1 hour');INSERT INTO batch_exam_results(batch_exam_subject_id,student_id)VALUES(1,1),(2,1)");
 await events.notifyBatchResults(1,1);assert.equal((await query("SELECT id FROM notifications WHERE event_key='batch-result:1'")).rows.length,0);
 await query('UPDATE batch_exam_subjects SET is_published=true,published_at=now() WHERE id=2');await events.notifyBatchResults(1,2);await dispatch();assert.equal((await query("SELECT id FROM notifications WHERE event_key='batch-result:1'")).rows.length,1);
 pass('batch exam notification waits until the complete transcript is visible and deduplicates subject publication');
 providerFailure=true;await delivery.createBulkNotificationsImmediately([{...event,eventKey:'provider-failure'}]);assert.ok((await query("SELECT id FROM notifications WHERE event_key='provider-failure'")).rows.length);providerFailure=false;
 unregistered=true;await delivery.createBulkNotificationsImmediately([{...event,eventKey:'dead-device'}]);assert.ok((await query("SELECT revoked_at FROM push_devices WHERE token='ExpoPushToken[parent]' ")).rows[0].revoked_at);unregistered=false;
 pass('provider outages preserve inbox events and unregistered-device errors disable stale tokens without logging them');
 const reminders=await load<typeof import('../src/lib/notification-reminders')>('src/lib/notification-reminders.ts');
 await memory.exec("INSERT INTO fee_invoices(institution_id,student_id,due_date,status,total_amount,paid_amount)VALUES(1,1,current_date-2,'DUE',100,0),(1,3,current_date-2,'PAID',100,100);INSERT INTO assignments(institution_id,class_id,section_id,title,due_at)VALUES(1,1,1,'Homework',now()+interval '2 hours');INSERT INTO submissions(institution_id,student_id,assignment_id)VALUES(1,3,1)");
 const first=await reminders.sendDueNotificationReminders(),second=await reminders.sendDueNotificationReminders();assert.equal(first.events,2);assert.equal(second.events,0);
 pass('deadline/overdue clock checks send directly once, exclude submitted work and paid invoices, and are repeatable');
 assert.ok(!readFileSync('src/lib/notifications.ts','utf8').includes('pendingPushJobs'));
 console.log(`Mobile notifications: ${checks} SQL/HTTP regression groups passed. Provider/native transport mocked; no production credentials used.`);
 }finally{globalThis.fetch=originalFetch;await memory.close();delete (globalThis as typeof globalThis & {__notificationFixture?:unknown}).__notificationFixture;delete (globalThis as typeof globalThis & {__fixtureNextResponse?:unknown}).__fixtureNextResponse;}
}
main().catch(error=>{console.error(error);process.exitCode=1;});
