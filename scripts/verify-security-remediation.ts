// Actual guards/helpers against synthetic data. No .env, external calls or application servers.
import assert from 'node:assert/strict';
import { csvCell } from '../src/lib/csv';
import { createRequire } from 'node:module';
import path from 'node:path';
import { build } from 'esbuild';
import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { NextRequest } from 'next/server';
import { unsafeOrigin, sessionRestriction } from '../src/lib/request-security';
import { readJsonBody, readBoundedFormData } from '../src/lib/http';
import { temporaryPassword } from '../src/lib/temporary-password';
import { onlineTestSchema, parseMcqAnswer } from '../src/lib/validators/online-test';
import { encryptStreamingCredentials, decryptStreamingCredentials } from '../src/lib/streaming-credentials';
async function main() {
  const memory = await PGlite.create();
  const state = { db:drizzle(memory), session:{role:'INSTITUTION_ADMIN',userId:73,institutionId:12}, uploadedOptions:{} as Record<string,unknown>, providerCalls:0, badResource:false, destroyed:0, delivery:'authenticated', grants:true, notificationFailure:false, wrongPasswordWaiters:[] as Array<()=>void> };
  (globalThis as any).__securityFix = state;
  const mocks: Record<string,string> = {
    '@/db':'export const db=globalThis.__securityFix.db;',
    '@/lib/auth':'export const getSession=async()=>globalThis.__securityFix.session; export const clearAuthCookies=async()=>{throw Error("Unexpected cookie mutation")}; export const revokeRefreshToken=async()=>{throw Error("Unexpected token revocation")};',
    '@/lib/admission-auth':'export const createAdmissionSessionToken=async()=>{throw Error("Unexpected token creation")}; export const setAdmissionSessionCookie=()=>{throw Error("Unexpected cookie mutation")};',
    '@/lib/institution-domain':"export const parseInstitutionHostname=()=>({kind:'institution',slug:'synthetic'});",
    '@/lib/public-site-domain':"export const getPublicSiteBaseDomain=async()=>'example.test';",
    '@/lib/institution-tenant':"export const resolveInstitutionTenant=async()=>({kind:'active',tenant:{id:12}});",
    '@/lib/argon2-pool':'export const verifyPassword=()=>new Promise(resolve=>{const waits=globalThis.__securityFix.wrongPasswordWaiters;waits.push(()=>resolve(false));if(waits.length===5)waits.forEach(done=>done());});',
    '@/lib/rbac':'export const getTenantContext=session=>session.institutionId; export const requireRole=(_roles,handler)=>(req,context={})=>handler(req,{...context,session:globalThis.__securityFix.session});',
    '@/lib/public-website-access':'export const isMainCampusWebsite=async()=>true;',
    '@/lib/notifications':'export const createOnlineTestNotifications=async(_input,store)=>{if(!store)throw Error("Transaction is required");if(globalThis.__securityFix.notificationFailure)throw Error("Synthetic notification storage failure")};',
    '@/lib/rate-limit':'export const withRateLimit=async()=>({success:true}); export const withUploadGrantLimit=async()=>({success:globalThis.__securityFix.grants,unavailable:!globalThis.__securityFix.grants});',
    '@/lib/cloudinary-config':"export const getCloudinaryConfig=()=>({cloudName:'fixture',apiKey:'fixture-key',apiSecret:'fixture-secret'});",
    'next/cache':'export const revalidatePath=()=>{};',
    '@/lib/api-policy':'export const withApiPolicy=fn=>fn;',
    '@/lib/student-verification-token':"export const readStudentVerificationToken=value=>value==='valid'?{studentId:1,institutionId:2,createdAt:Date.parse('2026-01-01T00:00:00Z')}:null;",
    'server-only':'',
    cloudinary:`import {Writable} from 'node:stream';const cloud={utils:{private_download_url(id,format,options){return JSON.stringify({id,format,...options})}},api:{resource:async(id,options)=>{if(options.type!=='authenticated'||globalThis.__securityFix.delivery!=='authenticated')throw Error('denied');return {public_id:id,resource_type:'image',type:'authenticated',bytes:42,format:'pdf'}}},uploader:{destroy:async()=>{globalThis.__securityFix.destroyed++},upload_stream(options,callback){const state=globalThis.__securityFix;state.providerCalls++;state.uploadedOptions=options;let bytes=0;return new Writable({write(chunk,_encoding,done){bytes+=chunk.length;done()},final(done){callback(null,{public_id:options.folder+'/'+options.public_id,resource_type:options.resource_type,type:options.type,bytes,format:state.badResource?'exe':options.resource_type==='raw'?undefined:'png',secure_url:'https://res.cloudinary.com/fixture/image.png'});done()}})}}};export default cloud;`,
  };
  const require = createRequire(path.resolve('package.json'));
  async function load<T>(entry:string):Promise<T> {
    const result=await build({entryPoints:[entry],bundle:true,write:false,platform:'node',format:'cjs',packages:'external',logLevel:'silent',plugins:[{name:'isolated-security',setup(b){
      b.onResolve({filter:/.*/},args=>{
        if(args.kind==='entry-point')return;
        if(mocks[args.path]!==undefined)return {path:args.path,namespace:'fixture'};
        if(args.path==='@/lib/cloudinary'||(args.path==='./cloudinary'&&args.resolveDir.endsWith('lib')))return {path:'cloudinary',namespace:'fixture'};
      });
      b.onLoad({filter:/.*/,namespace:'fixture'},args=>({contents:mocks[args.path],loader:'js'}));
    }}]});
    const moduleValue={exports:{} as T};new Function('require','module','exports',result.outputFiles[0].text)(require,moduleValue,moduleValue.exports);return moduleValue.exports;
  }
  try {
    await memory.exec(`CREATE TABLE tickets(id integer PRIMARY KEY,institution_id integer,status text,is_forwarded boolean,platform_status text,creator_role text,creator_id integer,title text,description text,created_at timestamp,updated_at timestamp);
      CREATE TABLE ticket_history(id serial PRIMARY KEY,ticket_id integer,actor_role text,actor_id integer,action text,notes text,created_at timestamp DEFAULT now());
      INSERT INTO tickets(id,institution_id,status,is_forwarded) VALUES(1,73,'RECEIVED',false),(2,12,'RECEIVED',false);`);
    const helpdesk=await load<typeof import('../src/app/actions/helpdesk-actions')>('src/app/actions/helpdesk-actions.ts');
    await assert.rejects(helpdesk.updateTicketStatusAction(1,'RESOLVED'),/not found/);
    await assert.rejects(helpdesk.forwardTicketAction(1),/not found/);
    await assert.rejects(helpdesk.updateTicketStatusAction(2,'INJECTED' as any),/Invalid status/);
    await helpdesk.updateTicketStatusAction(2,'RESOLVED'); await helpdesk.forwardTicketAction(2);
    assert.equal((await memory.query<any>('SELECT status FROM tickets WHERE id=1')).rows[0].status,'RECEIVED');
    assert.equal((await memory.query<any>('SELECT count(*)::integer AS count FROM ticket_history')).rows[0].count,2);
    console.log('PASS actual helpdesk actions reject cross-table ID collisions and invalid status, and accept own-tenant changes.');
    await memory.exec(`CREATE TABLE institutions(id integer PRIMARY KEY,parent_institution_id integer,name text,status text,deleted_at timestamp);
      CREATE TABLE students(id integer PRIMARY KEY,institution_id integer,name text,profile_picture_url text,login_roll_number text,created_at timestamp,class_id integer,section_id integer,class_roll_number text,academic_status text,year_of_joining integer,is_active boolean,deleted_at timestamp);
      CREATE TABLE classes(id integer PRIMARY KEY,institution_id integer,name text);
      CREATE TABLE sections(id integer PRIMARY KEY,institution_id integer,class_id integer,name text);
      INSERT INTO institutions VALUES(1,NULL,'Synthetic root','APPROVED',NULL),(2,1,'Synthetic campus','APPROVED',NULL);
      INSERT INTO students VALUES(1,2,'Synthetic student',NULL,'roll@fixture','2026-01-01 00:00:00',NULL,NULL,'01','ACTIVE',2026,true,NULL);`);
    const publicVerification=await load<typeof import('../src/app/api/public/student-verification/route')>('src/app/api/public/student-verification/route.ts');
    const verifyPublic=async(token='valid')=>(await publicVerification.GET(new NextRequest('https://example.test/api/public/student-verification?token='+token),undefined)).json();
    assert.equal((await verifyPublic()).verified,true);
    assert.equal((await verifyPublic('invalid')).verified,false);
    await memory.exec("UPDATE institutions SET status='REJECTED' WHERE id=1");assert.equal((await verifyPublic()).verified,false);
    await memory.exec("UPDATE institutions SET status='APPROVED' WHERE id=1; UPDATE institutions SET deleted_at=now() WHERE id=1");assert.equal((await verifyPublic()).verified,false);
    await memory.exec("UPDATE institutions SET deleted_at=NULL WHERE id=1; UPDATE institutions SET status='REJECTED' WHERE id=2");assert.equal((await verifyPublic()).verified,false);
    console.log('PASS public QR data requires a valid capability and both current campus and root approval/lifecycle checks.');
    const origin=(value?:string,extra:Record<string,string>={})=>new NextRequest('https://school.example.test/api/change',{method:'POST',headers:{host:'school.example.test',...(value?{origin:value}:{}),...extra}});
    assert.equal(unsafeOrigin(origin('https://other.example.test')),true);
    assert.equal(unsafeOrigin(origin('null')),true);
    assert.equal(unsafeOrigin(origin('https://school.example.test')),false);
    assert.equal(unsafeOrigin(origin(undefined,{'sec-fetch-site':'cross-site'})),true);
    assert.equal(unsafeOrigin(origin(undefined,{Authorization:'Bearer explicit-native-token'})),false);
    assert.equal(unsafeOrigin(origin('https://other.example.test',{Authorization:'Bearer fake',Cookie:'refresh_token=victim'})),true);
    assert.equal(unsafeOrigin(origin('https://other.example.test',{Authorization:'Bearer fake'}),{allowBearer:false}),true);
    assert.equal(unsafeOrigin(origin('https://school.example.test',{Authorization:'Bearer fake',Cookie:'access_token=victim'})),false);
    assert.equal(unsafeOrigin(origin('https://other.example.test',{Authorization:'Bearer malformed extra'})),true);
    const logout=await load<typeof import('../src/app/api/auth/logout/route')>('src/app/api/auth/logout/route.ts');
    assert.equal((await logout.POST(origin('https://other.example.test',{Authorization:'Bearer fake',Cookie:'refresh_token=victim'}))).status,403);
    assert.equal((await logout.POST(origin('https://other.example.test',{Authorization:'Bearer fake'}))).status,403);
    assert.equal(sessionRestriction({role:'STAFF',userId:1,mustChangePassword:true},'/api/staff/leaves'),'PASSWORD_CHANGE_REQUIRED');
    assert.equal(sessionRestriction({role:'STAFF',userId:1,mustChangePassword:true},'/api/auth/change-password'),null);
    assert.ok(sessionRestriction({role:'STUDENT',userId:1,studentAcademicStatus:'GRADUATED'},'/api/student/submissions'));
    console.log('PASS same-origin cookie mutations, explicit bearer transport and password/graduate path restrictions.');
    for (const input of ['=HYPERLINK("https://example.test")',' +SUM(1,2)','\t@SUM(1)',String.fromCharCode(0)+'-1']) assert.ok(csvCell(input).startsWith('"\''));
    assert.equal(csvCell('ordinary "name"'),'"ordinary ""name"""');
    console.log('PASS CSV fields neutralize formulas, including whitespace/control prefixes, and quote embedded delimiters.');
    const chunked=new Request('https://example.test',{method:'POST',body:new ReadableStream({start(c){c.enqueue(new Uint8Array(64));c.close();}}),duplex:'half'} as RequestInit);
    assert.equal((await readJsonBody(chunked,32)).ok,false);
    const form=new FormData();form.set('field','value');assert.equal((await readBoundedFormData(new Request('https://example.test',{method:'POST',body:form}))).get('field'),'value');
    await assert.rejects(readBoundedFormData(new Request('https://example.test',{method:'POST',headers:{'Content-Type':'multipart/form-data; boundary=fixture'},body:'x'.repeat(500)}),32),/too large/);
    assert.equal(new Set(Array.from({length:200},temporaryPassword)).size,200);
    console.log('PASS chunked JSON/multipart byte ceilings and independent random temporary credentials.');
    process.env.JWT_SECRET='synthetic-jwt-secret-at-least-32-characters';
    process.env.STREAMING_CREDENTIALS_SECRET='synthetic-old-credential-key-at-least-32-characters';process.env.STREAMING_CREDENTIALS_KEY_ID='old';
    const old=encryptStreamingCredentials({password:'synthetic-merchant-password'});
    process.env.STREAMING_CREDENTIALS_PREVIOUS_KEYS=JSON.stringify([{id:'old',secret:process.env.STREAMING_CREDENTIALS_SECRET}]);
    process.env.STREAMING_CREDENTIALS_SECRET='synthetic-new-credential-key-at-least-32-characters';process.env.STREAMING_CREDENTIALS_KEY_ID='new';
    assert.equal(decryptStreamingCredentials(old)?.password,'synthetic-merchant-password');
    const current=encryptStreamingCredentials(decryptStreamingCredentials(old)!);assert.match(current,/^v2.new\./);
    assert.equal(decryptStreamingCredentials(current.replace('v2.new.','v2.old.')),null,'key id is authenticated');
    delete process.env.STREAMING_CREDENTIALS_PREVIOUS_KEYS;assert.equal(decryptStreamingCredentials(old),null);assert.ok(decryptStreamingCredentials(current));
    console.log('PASS credential key rotation preserves old ciphertext with the old key, authenticates key IDs, and supports retirement.');
    const retired=await load<{POST(req:NextRequest):Promise<Response>}>('src/app/api/upload/signature/route.ts');
    const retiredResponse=await retired.POST(new NextRequest('https://school.example.test/api/upload/signature',{method:'POST'}));
    assert.equal(retiredResponse.status,410);assert.equal((await retiredResponse.json()).code,'UPLOAD_CLIENT_UPDATE_REQUIRED');
    assert.equal(state.providerCalls,0);
    const content=await load<{POST(req:NextRequest):Promise<Response>}>('src/app/api/upload/content/route.ts');
    const contentRequest=(purpose='image',file=new File(['synthetic image'],'picture.png',{type:'image/png'}))=>{
      const form=new FormData();form.set('file',file);form.set('purpose',purpose);
      return new NextRequest('https://school.example.test/api/upload/content',{method:'POST',body:form});
    };
    const firstUpload=await content.POST(contentRequest());assert.equal(firstUpload.status,200);const firstAsset=await firstUpload.json();
    assert.equal(state.uploadedOptions.overwrite,false);assert.equal(state.uploadedOptions.folder,'lms-uploads/tenant-12/institution-admin/user-73');assert.equal(state.uploadedOptions.type,'upload');
    const otherAsset=await (await content.POST(contentRequest())).json();assert.notEqual(firstAsset.public_id,otherAsset.public_id);
    const privateAsset=await (await content.POST(contentRequest('document',new File(['private notes'],'notes.txt',{type:'text/plain'})))).json();
    assert.equal(privateAsset.format,'txt');assert.equal(privateAsset.resource_type,'raw');assert.equal(privateAsset.secure_url,'');assert.equal(state.uploadedOptions.type,'authenticated');
    assert.equal((await content.POST(contentRequest('public-site-image'))).status,200);assert.equal(state.uploadedOptions.folder,'institution-public/12');
    const calls=state.providerCalls;
    await assert.rejects(content.POST(contentRequest('image',new File([new Uint8Array(5242881)],'large.png'))),/5 MB/);
    await assert.rejects(content.POST(contentRequest('image',new File(['x'],'script.svg'))),/type is not allowed/);
    assert.equal(state.providerCalls,calls,'invalid files never reach Cloudinary');
    state.grants=false;await assert.rejects(content.POST(contentRequest()),error=>Boolean(error && typeof error==='object' && 'status' in error && error.status===503));state.grants=true;
    state.badResource=true;await assert.rejects(content.POST(contentRequest()),/could not be verified/);assert.equal(state.destroyed,1);state.badResource=false;
    const oversized=new NextRequest('https://school.example.test/api/upload/content',{method:'POST',headers:{'Content-Type':'multipart/form-data; boundary=fixture'},body:new ReadableStream({start(controller){controller.enqueue(new Uint8Array(5300000));controller.close()}}),duplex:'half'} as NonNullable<ConstructorParameters<typeof NextRequest>[1]>);
    await assert.rejects(content.POST(oversized),error=>Boolean(error && typeof error==='object' && 'status' in error && error.status===413));
    console.log('PASS actual multipart upload handler bounds chunked/file bytes before provider calls, rejects unsupported files, assigns immutable tenant IDs, preserves private raw documents and checks provider responses.');
    const savedXhr=globalThis.XMLHttpRequest;
    let uploadStatus=200;
    let destination='';
    try {
      globalThis.XMLHttpRequest=class {
        upload:{onprogress?:(event:{lengthComputable:boolean;loaded:number;total:number})=>void}={};
        status=uploadStatus;
        response=uploadStatus===200?{public_id:'student-fees/12/73/5/proof',resource_type:'image',format:'png',secure_url:''}:{error:'Synthetic upload limit'};
        onload?:()=>void;
        open(method:string,url:string){assert.equal(method,'POST');destination=url;}
        send(form:FormData){assert.ok(form.get('file') instanceof File);assert.equal(form.get('purpose'),'image');this.upload.onprogress?.({lengthComputable:true,loaded:1,total:2});this.onload?.();}
      } as unknown as typeof XMLHttpRequest;
      const browser=await load<typeof import('../src/lib/client-upload-file')>('src/lib/client-upload-file.ts');
      const progress:number[]=[];
      const image=new File(['synthetic'],'proof.png',{type:'image/png'});
      await browser.uploadPreparedContent(image,'image',percent=>progress.push(percent),'/api/student/fees?invoiceId=5');
      assert.equal(destination,'/api/student/fees?invoiceId=5');assert.deepEqual(progress,[50]);
      const proofClient=await load<typeof import('../src/lib/upload-payment-image')>('src/lib/upload-payment-image.ts');
      assert.equal((await proofClient.uploadPaymentImage(image,{uploadUrl:'/api/student/fees?invoiceId=5'})).publicId,'student-fees/12/73/5/proof');
      await assert.rejects(browser.uploadPreparedContent(image,'image',undefined,'https://other.example.test/upload'),/Invalid upload destination/);
      uploadStatus=429;await assert.rejects(browser.uploadPreparedContent(image),/Synthetic upload limit/);
    } finally {globalThis.XMLHttpRequest=savedXhr;}
    console.log('PASS actual browser/payment upload helpers send multipart files to authenticated API targets, preserve progress and surface errors without sending files to arbitrary origins.');
    const files=await load<typeof import('../src/lib/submission-file')>('src/lib/submission-file.ts');
    const id='lms-uploads/tenant-12/institution-admin/user-73/synthetic';
    const resource=await files.verifyCloudinarySubmission(id,state.session as any);assert.match(resource.secure_url,/^private-file:v1:/);
    const link=JSON.parse(files.privateFileUrl(resource.secure_url)!);assert.equal(link.type,'authenticated');assert.ok(link.expires_at<=Date.now()/1000+301);
    assert.equal(files.privateFileUrl('https://res.cloudinary.com/fixture/image/upload/public.pdf'),null);
    state.delivery='upload';await assert.rejects(files.verifyCloudinarySubmission(id,state.session as any));
    await assert.rejects(files.verifyCloudinarySubmission(id.replace('tenant-12','tenant-73'),state.session as any));
    console.log('PASS private verification refuses public/foreign assets and emits expiring links.');
    await memory.exec(`CREATE TABLE admission_applicant_accounts(id integer PRIMARY KEY,institution_id integer,guardian_email text,password_hash text,must_change_password boolean DEFAULT false,session_version integer DEFAULT 0,failed_login_count integer DEFAULT 0,locked_until timestamp,last_login_at timestamp,created_at timestamp DEFAULT now(),updated_at timestamp DEFAULT now());
      INSERT INTO admission_applicant_accounts(id,institution_id,guardian_email,password_hash) VALUES(1,12,'guardian@example.test','synthetic-hash');`);
    const applicantLogin=await load<typeof import('../src/app/api/public/admissions/auth/login/route')>('src/app/api/public/admissions/auth/login/route.ts');
    const failedLogin=()=>applicantLogin.POST(new NextRequest('https://school.example.test/api/public/admissions/auth/login',{method:'POST',headers:{host:'school.example.test'},body:JSON.stringify({email:'guardian@example.test',password:'wrong-password'})}));
    const failures=await Promise.all(Array.from({length:5},failedLogin));
    failures.forEach(response=>assert.equal(response.status,401));
    const lockout=(await memory.query<{failed_login_count:number;locked_until:Date}>('SELECT failed_login_count,locked_until FROM admission_applicant_accounts WHERE id=1')).rows[0];
    assert.equal(lockout.failed_login_count,5);assert.ok(new Date(lockout.locked_until).getTime()>Date.now());
    assert.equal((await failedLogin()).status,401);assert.equal(state.wrongPasswordWaiters.length,5,'locked accounts do not reach password hashing');
    console.log('PASS five concurrent invalid applicant logins retain all failure increments and enforce the account lockout.');

    for (const value of [null, undefined, '', ' ', false, true, [], {}, -1, 4, 0.5, NaN, Infinity, '0.0']) {
      assert.throws(()=>parseMcqAnswer(value));
    }
    for (const value of [0,1,2,3,'0','1','2','3']) assert.equal(parseMcqAnswer(value),Number(value));
    const validTest={sectionId:1,subjectId:1,title:'Synthetic quiz',mode:'MCQ',durationMinutes:30,mcqs:[{prompt:'Choose one',options:['A','B','C','D'],correctOptionIndex:0,marks:2}],shortQuestions:[]};
    assert.equal(onlineTestSchema.safeParse(validTest).success,true);
    for (const patch of [{title:' '},{durationMinutes:-1},{durationMinutes:Infinity},{mcqs:[]},{mcqs:[{...validTest.mcqs[0],marks:-1}]},{mcqs:[{...validTest.mcqs[0],correctOptionIndex:4}]},{mcqs:[{...validTest.mcqs[0],options:['A']}]},{mode:'MIX'}]) {
      assert.equal(onlineTestSchema.safeParse({...validTest,...patch}).success,false);
    }
    await memory.exec(`
      CREATE TABLE subjects(id integer PRIMARY KEY,institution_id integer,name text);
      CREATE TABLE staff_assignments(id serial PRIMARY KEY,staff_id integer,institution_id integer,section_id integer,subject_id integer);
      CREATE TABLE tests(id serial PRIMARY KEY,institution_id integer,class_id integer,section_id integer,subject_id integer,staff_id integer,created_by_role text,type text,title varchar(255),max_marks real,date date,end_date date,results_published_at timestamp,created_at timestamp DEFAULT now());
      CREATE TABLE online_tests(id serial PRIMARY KEY,institution_id integer,test_id integer REFERENCES tests(id),mode text,duration_minutes integer,created_at timestamp DEFAULT now());
      CREATE TABLE online_test_questions(id serial PRIMARY KEY,online_test_id integer REFERENCES online_tests(id),question_type text,prompt text CHECK(prompt <> 'simulate-storage-failure'),options jsonb,correct_option_index integer,marks real,order_index integer);
      INSERT INTO classes VALUES(1,12,'Synthetic class');
      INSERT INTO sections VALUES(1,12,1,'Synthetic section');
      INSERT INTO subjects VALUES(1,12,'Synthetic subject');
      INSERT INTO staff_assignments(staff_id,institution_id,section_id,subject_id) VALUES(73,12,1,1);
    `);
    state.session={role:'STAFF',userId:73,institutionId:12};
    const hosted=await load<{POST(req:NextRequest):Promise<Response>}>('src/app/api/staff/host-tests/route.ts');
    const postTest=(value:unknown)=>hosted.POST(new NextRequest('https://school.example.test/api/staff/host-tests',{method:'POST',body:JSON.stringify(value)}));
    assert.equal((await postTest({...validTest,mcqs:[{...validTest.mcqs[0],marks:-2}]})).status,400);
    assert.equal((await postTest({...validTest,sectionId:2})).status,403);
    assert.equal((await postTest(validTest)).status,200);
    const counts=async()=>(await memory.query<{tests:number;online:number;questions:number}>('SELECT (SELECT count(*)::int FROM tests) AS tests,(SELECT count(*)::int FROM online_tests) AS online,(SELECT count(*)::int FROM online_test_questions) AS questions')).rows[0];
    assert.deepEqual(await counts(),{tests:1,online:1,questions:1});
    assert.notEqual((await postTest({...validTest,mcqs:[{...validTest.mcqs[0],prompt:'simulate-storage-failure'}]})).status,200);
    assert.deepEqual(await counts(),{tests:1,online:1,questions:1},'failed question insert rolls back the parent records');
    const actions=await load<typeof import('../src/app/actions/online-test-actions')>('src/app/actions/online-test-actions.ts');
    const webForm=(prompt='Choose one')=>{
      const form=new FormData();
      for(const [key,value] of Object.entries({sectionId:'1',subjectId:'1',title:'Synthetic web quiz',mode:'MCQ',durationMinutes:'30',mcqMarks:'2',mcqPrompt:prompt,'mcqCorrect-0':'0','mcqOption-0-0':'A','mcqOption-0-1':'B','mcqOption-0-2':'C','mcqOption-0-3':'D'}))form.set(key,value);
      return form;
    };
    const missingCorrect=webForm();missingCorrect.delete('mcqCorrect-0');await assert.rejects(actions.createOnlineTestAction(missingCorrect),/correct option/);
    await assert.rejects(actions.createOnlineTestAction(webForm('simulate-storage-failure')));
    assert.deepEqual(await counts(),{tests:1,online:1,questions:1});
    state.notificationFailure=true;
    await assert.rejects(actions.createOnlineTestAction(webForm()),/notification storage/);
    assert.deepEqual(await counts(),{tests:1,online:1,questions:1},'notification failure rolls back test, online test and questions');
    state.notificationFailure=false;
    await actions.createOnlineTestAction(webForm());
    assert.deepEqual(await counts(),{tests:2,online:2,questions:2});
    console.log('PASS actual HTTP and Server Action test creation validate questions/marks, reject unassigned sections, roll back partial writes and preserve valid creation. Blank or malformed MCQ answers are rejected.');
  } finally { await memory.close(); delete (globalThis as any).__securityFix; }
}
main().catch(error=>{console.error(error);process.exitCode=1;});
