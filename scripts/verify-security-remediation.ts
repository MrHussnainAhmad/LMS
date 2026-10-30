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
import { encryptStreamingCredentials, decryptStreamingCredentials } from '../src/lib/streaming-credentials';
async function main() {
  const memory = await PGlite.create();
  const state = { db:drizzle(memory), session:{role:'INSTITUTION_ADMIN',userId:73,institutionId:12}, signed:{} as Record<string,unknown>, preset:{unsigned:false,settings:{max_file_size:5242880}}, delivery:'authenticated', grants:true };
  (globalThis as any).__securityFix = state;
  const mocks: Record<string,string> = {
    '@/db':'export const db=globalThis.__securityFix.db;',
    '@/lib/auth':'export const getSession=async()=>globalThis.__securityFix.session;',
    '@/lib/rbac':'export const requireRole=(_roles,handler)=>req=>handler(req,{session:globalThis.__securityFix.session});',
    '@/lib/rate-limit':'export const withRateLimit=async()=>({success:true}); export const withUploadGrantLimit=async()=>({success:globalThis.__securityFix.grants,unavailable:!globalThis.__securityFix.grants});',
    '@/lib/cloudinary-config':"export const getCloudinaryConfig=()=>({cloudName:'fixture',apiKey:'fixture-key',apiSecret:'fixture-secret'});",
    'next/cache':'export const revalidatePath=()=>{};',
    '@/lib/api-policy':'export const withApiPolicy=fn=>fn;',
    '@/lib/student-verification-token':"export const readStudentVerificationToken=value=>value==='valid'?{studentId:1,institutionId:2,createdAt:Date.parse('2026-01-01T00:00:00Z')}:null;",
    'server-only':'',
    cloudinary:`const cloud={utils:{api_sign_request(fields){globalThis.__securityFix.signed=fields;return 'fixture-signature'},private_download_url(id,format,options){return JSON.stringify({id,format,...options})}},api:{upload_preset:async()=>globalThis.__securityFix.preset,resource:async(id,options)=>{if(options.type!=='authenticated'||globalThis.__securityFix.delivery!=='authenticated')throw Error('denied');return {public_id:id,resource_type:'image',type:'authenticated',bytes:42,format:'pdf'}}}};export default cloud;`,
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
    process.env.CLOUDINARY_CONTENT_UPLOAD_PRESET='signed-fixture';
    const uploads=await load<{POST(req:NextRequest):Promise<Response>}>('src/app/api/upload/signature/route.ts');
    const uploadReq=(document=true)=>new NextRequest('https://school.example.test/api/upload/signature',{method:'POST',body:JSON.stringify(document?{purpose:'document',format:'pdf'}:{})});
    const first=await uploads.POST(uploadReq());assert.equal(first.status,200);const grant=await first.json();
    assert.equal(state.signed.type,'authenticated');assert.equal(state.signed.overwrite,false);assert.equal(state.signed.public_id,grant.publicId);assert.equal(state.signed.upload_preset,'signed-fixture');
    const second=await (await uploads.POST(uploadReq())).json();assert.notEqual(grant.publicId,second.publicId);
    await uploads.POST(uploadReq(false));assert.equal(state.signed.type,'upload');assert.equal(state.signed.allowed_formats,'jpg,jpeg,png,webp');
    state.preset.settings.max_file_size=100000000;assert.equal((await uploads.POST(uploadReq())).status,503);state.preset.settings.max_file_size=5242880;
    state.grants=false;assert.equal((await uploads.POST(uploadReq())).status,503);
    const files=await load<typeof import('../src/lib/submission-file')>('src/lib/submission-file.ts');
    const id='lms-uploads/tenant-12/institution-admin/user-73/synthetic';
    const resource=await files.verifyCloudinarySubmission(id,state.session as any);assert.match(resource.secure_url,/^private-file:v1:/);
    const link=JSON.parse(files.privateFileUrl(resource.secure_url)!);assert.equal(link.type,'authenticated');assert.ok(link.expires_at<=Date.now()/1000+301);
    assert.equal(files.privateFileUrl('https://res.cloudinary.com/fixture/image/upload/public.pdf'),null);
    state.delivery='upload';await assert.rejects(files.verifyCloudinarySubmission(id,state.session as any));
    await assert.rejects(files.verifyCloudinarySubmission(id.replace('tenant-12','tenant-73'),state.session as any));
    console.log('PASS signed grants bind unique IDs, no overwrite, delivery type, formats and bounded preset; private verification refuses public/foreign assets and emits expiring links.');
  } finally { await memory.close(); delete (globalThis as any).__securityFix; }
}
main().catch(error=>{console.error(error);process.exitCode=1;});
