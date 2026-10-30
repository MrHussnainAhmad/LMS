// Isolated PostgreSQL fixtures and mocked provider transport; never loads .env.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { randomUUID } from 'node:crypto';
import { build } from 'esbuild';
import { PGlite } from '@electric-sql/pglite';
import { pg_trgm } from '@electric-sql/pglite/contrib/pg_trgm';
import { drizzle } from 'drizzle-orm/pglite';
import { and,eq } from 'drizzle-orm';
import { NextRequest } from 'next/server';
import * as schema from '../src/db/schema';
const require=createRequire(import.meta.url);

test('online payments: migration, configuration, access, provider verification and atomic receipts',async t=>{
  const memory=await PGlite.create({extensions:{pg_trgm}});const db=drizzle(memory);
  const state={db,session:{role:'INSTITUTION',userId:1,institutionId:1,mustChangePassword:false},applicant:null as null|{applicantId:number;institutionId:number;sessionVersion:number},redisStatus:'ready',checkoutTickets:new Map<string,{value:string;expires:number}>()};
  (globalThis as {__onlinePaymentFixture?:typeof state}).__onlinePaymentFixture=state;
  const mocks:Record<string,string>={
    '../notification-delivery':'export const createNotification=async()=>undefined;export const createBulkNotifications=async()=>[];',
    '@/lib/notification-delivery':'export const createNotification=async()=>undefined;export const createBulkNotifications=async()=>[];',
    '@/db':'export const db=globalThis.__onlinePaymentFixture.db;',
    '@/lib/auth':'export const getSessionFromRequest=async()=>globalThis.__onlinePaymentFixture.session;export const getLightSessionFromRequest=getSessionFromRequest;export const getWarmSessionFromRequest=()=>null;export const timingSafeEqual=(a,b)=>a===b;',
    '@/lib/admission-auth':'export const getAdmissionSessionFromRequest=async()=>globalThis.__onlinePaymentFixture.applicant;',
    '@/lib/public-site-domain':"export const getPublicSiteBaseDomain=async()=> 'example.test';",
    '@/lib/rate-limit':'export const withRateLimit=async()=>({success:true});',
    '@/lib/redis':`export const redis={get status(){return globalThis.__onlinePaymentFixture.redisStatus},async set(key,value,_ex,ttl){globalThis.__onlinePaymentFixture.checkoutTickets.set(key,{value,expires:Date.now()+ttl*1000});return 'OK'},async getdel(key){const tickets=globalThis.__onlinePaymentFixture.checkoutTickets;const value=tickets.get(key);tickets.delete(key);return value&&value.expires>Date.now()?value.value:null}};`,
  };
  mocks['./auth']=mocks['@/lib/auth'];
  mocks['./rate-limit']=mocks['@/lib/rate-limit'];
  async function load<T>(entry:string):Promise<T>{
    const result=await build({entryPoints:[entry],bundle:true,write:false,platform:'node',format:'cjs',packages:'external',logLevel:'silent',plugins:[{name:'payment-fixtures',setup(b){
      b.onResolve({filter:/.*/},args=>mocks[args.path]?{path:args.path,namespace:'fixture'}:undefined);
      b.onLoad({filter:/.*/,namespace:'fixture'},args=>({contents:mocks[args.path],loader:'js'}));
    }}]});const moduleValue={exports:{} as T};new Function('require','module','exports',result.outputFiles[0].text)(require,moduleValue,moduleValue.exports);return moduleValue.exports;
  }
  const originalFetch=globalThis.fetch;
  try {
    process.env.JWT_SECRET='isolated-online-payment-secret-at-least-32-characters';
    process.env.STREAMING_CREDENTIALS_SECRET='isolated-online-credential-secret-at-least-32-characters';
    process.env.APP_DOMAIN='example.test';process.env.PAYMENT_PUBLIC_ORIGIN='https://example.test';delete process.env.PAYMENT_VERIFIED_GATEWAYS;
    process.env.JAZZCASH_SANDBOX_CHECKOUT_URL='https://sandbox.jazzcash.com.pk/CustomerPortal/transactionmanagement/merchantform/';
    process.env.EASYPAISA_SANDBOX_INITIATE_URL='https://easypaystg.easypaisa.com.pk/easypay-service/rest/v4/initiate-ma-transaction';
    process.env.EASYPAISA_SANDBOX_INQUIRY_URL='https://easypaystg.easypaisa.com.pk/easypay-service/rest/v4/inquire-transaction';
    const journal=JSON.parse(await readFile('drizzle/meta/_journal.json','utf8'));
    for(const entry of journal.entries)await memory.exec(await readFile(`drizzle/${entry.tag}.sql`,'utf8'));
    await memory.exec('CREATE TABLE nisaab360_supplemental_migrations(name text PRIMARY KEY,sha256 text NOT NULL)');
    const runner=await readFile('scripts/migrate-production.mjs','utf8');
    const names=JSON.parse(runner.match(/const SUPPLEMENTAL_MIGRATIONS = (\[[\s\S]*?\]);/)![1].replace(/\/\/[^\n]*/g,'').replace(/,\s*\]/,']')) as string[];
    for(const name of names){const sql=await readFile(`drizzle/${name}`,'utf8');
      if(/CREATE\s+(?:UNIQUE\s+)?INDEX\s+CONCURRENTLY/i.test(sql))for(const statement of sql.replace(/^\s*--.*$/gm,'').split(';').map(v=>v.trim()).filter(Boolean))await memory.exec(statement);
      else await memory.exec(sql);
      await memory.query('INSERT INTO nisaab360_supplemental_migrations VALUES($1,$2)',[name,'fixture']);
    }
    await memory.exec(await readFile('drizzle/0077_online_payment_modes.sql','utf8'));
    const institution={name:'Fixture school',type:'COLLEGE' as const,username:'school',country:'PK',city:'Test',address:'Test',contactEmail:'fixture@example.test',contactPhone:'0',registrationNumber:'0',pricingPlan:'BASIC' as const,logoKey:'fixture',proofDocumentKey:'fixture',adminPasswordHash:'fixture',status:'APPROVED' as const,publicSlug:'school'};
    const [root,other]=await db.insert(schema.institutions).values([institution,{...institution,name:'Other school',username:'other',publicSlug:'other'}]).returning();
    state.session.institutionId=root.id;state.session.userId=root.id;
    const [campus]=await db.insert(schema.campuses).values({institutionId:root.id,name:'Main'}).returning();
    const [schoolClass]=await db.insert(schema.classes).values({institutionId:root.id,name:'Class A'}).returning();
    const [section]=await db.insert(schema.sections).values({institutionId:root.id,classId:schoolClass.id,name:'A'}).returning();
    const [student]=await db.insert(schema.students).values({institutionId:root.id,name:'Student',loginRollNumber:'fixture-student',passwordHash:'fixture',classId:schoolClass.id,sectionId:section.id,yearOfJoining:2026,classRollNumber:'1'}).returning();
    const [parent]=await db.insert(schema.parentAccounts).values({institutionId:root.id,email:'parent@example.test',passwordHash:'fixture',status:'ACTIVE',mustChangePassword:false}).returning();
    await db.insert(schema.parentStudents).values({institutionId:root.id,parentId:parent.id,studentId:student.id,linkedById:root.id,linkedByRole:'INSTITUTION'});
    const invoice=async()=> (await db.insert(schema.feeInvoices).values({institutionId:root.id,studentId:student.id,billingMonth:'2026-10',billingKey:randomUUID(),billingKind:'ONE_TIME',billingLabel:'Fixture',dueDate:'2026-10-31',subtotal:1000,totalAmount:1000,paidAmount:0,status:'DUE'}).returning())[0];
    const fee=await invoice();
    const config=await load<typeof import('../src/lib/payments/config')>('src/lib/payments/config.ts');
    const service=await load<typeof import('../src/lib/payments/service')>('src/lib/payments/service.ts');
    const providers=await load<typeof import('../src/lib/payments/providers')>('src/lib/payments/providers.ts');
    const endpoints=await load<typeof import('../src/lib/payments/endpoints')>('src/lib/payments/endpoints.ts');
    const target={institutionId:root.id,studentId:student.id,invoiceId:fee.id};
    const jazz={merchantId:'MID-FIXTURE',password:'fixture-password',integritySalt:'fixture-salt'};
    const easy={storeId:'123',accountNum:'456',username:'fixture-api',password:'fixture-password'};
    const feeOptions=await load<typeof import('../src/app/api/student/fees/pay/route')>('src/app/api/student/fees/pay/route.ts');
    await t.test('Easypaisa credentials enable production; password-bearing JazzCash checkout remains unavailable',async()=>{
      for (const name of ['JAZZCASH_CHECKOUT_URL','EASYPAISA_INITIATE_URL','EASYPAISA_INQUIRY_URL']) delete process.env[name];
      assert.equal((await config.readPaymentConfig(root.id)).mode,'MANUAL');assert.deepEqual(config.GATEWAYS,['jazzcash','easypaisa']);
      await assert.rejects(()=>config.updatePaymentConfig(root.id,{action:'mode',mode:'ONLINE'}));
      await assert.rejects(()=>config.updatePaymentConfig(root.id,{action:'gateway',gateway:'hblpay',enabled:true,environment:'sandbox',credentials:jazz}));
      for (const [gateway, credentials] of [['easypaisa',easy]] as const) {
        const saved=await config.updatePaymentConfig(root.id,{action:'gateway',gateway,enabled:true,environment:'production',credentials,activateOnline:true});
        assert.equal(saved.mode,'ONLINE','A single gateway save must also activate Online payments');
        const visible=saved.gateways.find(value=>value.id===gateway)!;
        assert.equal(visible.configured,true);
        assert.equal(visible.ready,true);
        assert.equal(visible.notReadyReason,null);
        assert.equal((await config.readPaymentConfig(root.id)).gateways[gateway]?.environment,'production');
        assert.ok(!JSON.stringify(saved).includes('fixture-password'));
        assert.ok(!JSON.stringify(saved).includes('fixture-salt'));
        for (const [role,userId] of [['STUDENT',student.id],['PARENT',parent.id]] as const) {
          state.session={role,userId,institutionId:root.id,mustChangePassword:false};
          const options=await feeOptions.GET(new NextRequest(`https://example.test/api/student/fees/pay?invoiceId=${fee.id}&studentId=${student.id}`),{});
          assert.equal(options.status,200);
          const body=await options.json();
          assert.equal(body.mode,'ONLINE');
          assert.ok(body.gateways.some((value:{id:string})=>value.id===gateway));
          assert.ok(!JSON.stringify(body).includes('fixture-password'));
        }
        state.session={role:'INSTITUTION',userId:root.id,institutionId:root.id,mustChangePassword:false};
        const productionFee=await invoice();
        const payment=await service.createPaymentAttempt({...target,invoiceId:productionFee.id},gateway);
        assert.equal(payment.environment,'production');
        assert.equal(payment.merchantId,easy.storeId);
        assert.equal(payment.institutionId,root.id);
        await config.updatePaymentConfig(root.id,{action:'mode',mode:'MANUAL'});
      }
      assert.equal(endpoints.endpointsReady('jazzcash','production'),false);
      const contained=await config.updatePaymentConfig(root.id,{action:'gateway',gateway:'jazzcash',enabled:true,environment:'production',credentials:jazz,activateOnline:true});
      assert.equal(contained.gateways.find(value=>value.id==='jazzcash')?.ready,false);
      await assert.rejects(async()=>service.createPaymentAttempt({...target,invoiceId:(await invoice()).id},'jazzcash'));
      await config.updatePaymentConfig(root.id,{action:'mode',mode:'MANUAL'});
      assert.throws(()=>providers.jazzCashCheckout({} as never,jazz),/disabled/);
      assert.equal(endpoints.gatewayEndpoint('jazzcash','production','checkout'),'https://payments.jazzcash.com.pk/CustomerPortal/transactionmanagement/merchantform/');
      assert.equal(endpoints.gatewayEndpoint('easypaisa','production','initiate'),'https://easypay.easypaisa.com.pk/easypay-service/rest/v4/initiate-ma-transaction');
      assert.equal(endpoints.gatewayEndpoint('easypaisa','production','inquiry'),'https://easypay.easypaisa.com.pk/easypay-service/rest/v4/inquire-transaction');
    });
    await t.test('automatic Online activation preserves manual proof review and rolls back a rejected save',async()=>{
      const before=await config.readPaymentConfig(root.id);
      const [proof]=await db.insert(schema.feePaymentSubmissions).values({institutionId:root.id,invoiceId:fee.id,studentId:student.id,amount:1000,sourceBankName:'Fixture',transactionId:'manual-fixture',proofFileKey:'fixture-proof',status:'SUBMITTED'}).returning();
      await assert.rejects(()=>config.updatePaymentConfig(root.id,{action:'gateway',gateway:'easypaisa',enabled:true,environment:'production',credentials:{...easy,storeId:'999'},activateOnline:true}),/Review pending manual payments/);
      assert.deepEqual(await config.readPaymentConfig(root.id),before);
      await db.delete(schema.feePaymentSubmissions).where(eq(schema.feePaymentSubmissions.id,proof.id));
      const disabled=await config.updatePaymentConfig(root.id,{action:'gateway',gateway:'easypaisa',enabled:false,environment:'production',credentials:easy,activateOnline:true});
      assert.equal(disabled.mode,'MANUAL');
    });
    await t.test('both credentials encrypted/masked; blank secrets preserved; tenant isolation',async()=>{
      await config.updatePaymentConfig(root.id,{action:'gateway',gateway:'jazzcash',enabled:true,environment:'sandbox',credentials:jazz});
      const publicConfig=await config.updatePaymentConfig(root.id,{action:'gateway',gateway:'easypaisa',enabled:true,environment:'sandbox',credentials:easy});
      assert.ok(!JSON.stringify(publicConfig).includes('fixture-password'));assert.equal(publicConfig.gateways.filter(g=>g.ready).length,1);
      const [row]=await db.select().from(schema.institutionPaymentGateways);assert.ok(!row.credentialsEncrypted.includes('fixture-salt'));
      await config.updatePaymentConfig(root.id,{action:'gateway',gateway:'jazzcash',enabled:true,environment:'sandbox',credentials:{merchantId:jazz.merchantId,password:'',integritySalt:''}});
      assert.equal((await config.readPaymentConfig(root.id)).gateways.jazzcash?.credentials.password,jazz.password);
      assert.equal((await config.readPaymentConfig(other.id)).mode,'MANUAL');
      await config.updatePaymentConfig(root.id,{action:'mode',mode:'ONLINE'});
    });
    // Historical pending attempts still need authenticated callbacks and settlement after containment.
    async function legacyAttempt(invoiceId:number) {
      return (await db.insert(schema.gatewayPaymentAttempts).values({id:'N'+Math.random().toString(36).slice(2,16).toUpperCase(),institutionId:root.id,invoiceId,gateway:'jazzcash',environment:'sandbox',merchantId:jazz.merchantId,
        amount:1000,credentialsEncrypted:service.credentialSnapshot({enabled:true,environment:'sandbox',credentials:jazz}),returnUrl:'https://example.test/api/payments/jazzcash/return',portalOrigin:'https://student.example.test',
        institutionName:root.name,payerName:student.name,description:'Historical fixture',expiresAt:new Date(Date.now()+100000)}).returning())[0];
    }
    const attempt=await legacyAttempt(fee.id);
    await t.test('unique attempt reuses pending order; gateway changes blocked',async()=>{
      const openTarget={...target,invoiceId:(await invoice()).id};
      const pending=await service.createPaymentAttempt(openTarget,'easypaisa');
      assert.equal((await service.createPaymentAttempt(openTarget,'easypaisa')).id,pending.id);
      await assert.rejects(()=>service.createPaymentAttempt(openTarget,'jazzcash'));
      assert.equal(attempt.amount,1000);assert.equal(attempt.institutionId,root.id);
    });
    const fields=(payment:typeof attempt,reference='RRN-FIXTURE')=>{
      const value={pp_TxnRefNo:payment.id,pp_MerchantID:payment.merchantId,pp_Amount:String(payment.amount*100),pp_TxnCurrency:'PKR',pp_ResponseCode:'000',pp_RetreivalReferenceNo:reference,pp_SecureHash:''};
      value.pp_SecureHash=providers.jazzCashHash(value,jazz.integritySalt);return value;
    };
    await t.test('native handoff cannot mint a capability or expose a merchant password for a disabled integration',async()=>{
      const native=await load<typeof import('../src/lib/payments/native-checkout')>('src/lib/payments/native-checkout.ts');
      const resource=await load<typeof import('../src/app/api/payments/[id]/route')>('src/app/api/payments/[id]/route.ts');
      const payment=await legacyAttempt((await invoice()).id);
      const context={params:Promise.resolve({id:payment.id})};
      const request=()=>new NextRequest(`https://example.test/api/payments/${payment.id}`,{method:'POST',body:JSON.stringify({action:'browserCheckout'})});
      state.session={role:'STUDENT',userId:student.id,institutionId:other.id,mustChangePassword:false};
      assert.equal((await resource.POST(request(),context)).status,404);
      state.session.institutionId=root.id;
      const denied=await resource.POST(request(),context);assert.equal(denied.status,409);
      assert.ok(!(await denied.text()).includes('fixture-password'));
      assert.equal(state.checkoutTickets.size,0);
      await assert.rejects(()=>native.issueNativeCheckout(payment.id),/unavailable/);
      await assert.rejects(()=>service.startPayment(payment.id,{phone:'',email:''}));
      assert.equal((await service.getPaymentAttempt(payment.id)).initiationStartedAt,null);
      state.session={role:'INSTITUTION',userId:root.id,institutionId:root.id,mustChangePassword:false};
    });
    await t.test('official HMAC vector, wrong signature, wrong amount and wrong merchant rejected',async()=>{
      assert.equal(providers.jazzCashHash({pp_MerchantID:'MER123',pp_OrderInfo:'A48cvE28',pp_Amount:'2995'},'0F5DD14AE2'),'C7689CDA7474EB1ADCD343FD0C0B676BAD0BA66361CC46DB589BDB0DA4C1C867');
      assert.throws(()=>providers.verifyJazzCash({...fields(attempt),pp_SecureHash:'0'.repeat(64)},attempt,jazz));
      const wrong={...fields(attempt),pp_Amount:'1'};wrong.pp_SecureHash=providers.jazzCashHash(wrong,jazz.integritySalt);assert.throws(()=>providers.verifyJazzCash(wrong,attempt,jazz));
      const merchant={...fields(attempt),pp_MerchantID:'OTHER'};merchant.pp_SecureHash=providers.jazzCashHash(merchant,jazz.integritySalt);assert.throws(()=>providers.verifyJazzCash(merchant,attempt,jazz));
    });
    await t.test('sandbox receipt shared and idempotent; real challan unchanged',async()=>{
      const evidence=providers.verifyJazzCash(fields(attempt),attempt,jazz);
      await service.settlePayment(attempt.id,evidence);await service.settlePayment(attempt.id,evidence);
      const paid=await service.getPaymentAttempt(attempt.id);assert.equal(paid.status,'PAID');assert.match(paid.receiptNumber!,/^TEST-/);
      assert.equal((await db.select().from(schema.feePayments)).length,0);
      assert.equal((await db.select().from(schema.feeInvoices).where(eq(schema.feeInvoices.id,fee.id)))[0].paidAmount,0);
    });
    await t.test('receipt access enforces tenant/student scope without exposing credential snapshots',async()=>{
      const access=await load<typeof import('../src/lib/payments/access')>('src/lib/payments/access.ts');
      const request=new NextRequest('https://student.example.test/api/payments');
      state.session={role:'STUDENT',userId:student.id,institutionId:root.id,mustChangePassword:false};
      const scope=await access.paymentAccess(request);assert.ok(scope);
      const own=await db.select(access.publicPaymentFields).from(schema.gatewayPaymentAttempts).where(and(scope!,eq(schema.gatewayPaymentAttempts.id,attempt.id)));assert.equal(own.length,1);
      assert.ok(!JSON.stringify(own).includes('credentialsEncrypted'));
      state.session.institutionId=other.id;const foreign=await access.paymentAccess(request);assert.equal((await db.select().from(schema.gatewayPaymentAttempts).where(and(foreign!,eq(schema.gatewayPaymentAttempts.id,attempt.id)))).length,0);
      state.session.institutionId=root.id;
    });
    await t.test('Manual submission is rejected server-side while Online is active',async()=>{
      const manual=await load<typeof import('../src/lib/payments/manual-mode')>('src/lib/payments/manual-mode.ts');
      await assert.rejects(()=>db.transaction(tx=>manual.assertManualPayment(tx as never,root.id,{invoiceId:fee.id})));
    });
    let easyTerms:typeof attempt;
    await t.test('Easypaisa initiation is claimed once; server inquiry verifies merchant and amount',async()=>{
      const next=await invoice();easyTerms=await service.createPaymentAttempt({institutionId:root.id,studentId:student.id,invoiceId:next.id},'easypaisa');
      let initiations=0;
      await memory.exec("SET TIME ZONE 'Asia/Karachi'");
      globalThis.fetch=async(input,init)=>{
        const body=JSON.parse(String(init?.body));assert.equal((init?.headers as Record<string,string>).Credentials,Buffer.from('fixture-api:fixture-password').toString('base64'));
        if(String(input).endsWith('initiate-ma-transaction')){initiations++;assert.equal(body.transactionType,'MA');return Response.json({orderId:body.orderId,storeId:'123',responseCode:'0000'});}
        return Response.json({orderId:body.orderId,storeId:'123',accountNum:'456',transactionAmount:'1000.00',paymentMode:'MA',transactionStatus:'PAID',responseCode:'0000',transactionId:'EP-TEST'});
      };
      await service.startPayment(easyTerms.id,{phone:'03001234567',email:'fixture@example.test'});
      assert.equal((await service.getPaymentAttempt(easyTerms.id)).status,'PAID');assert.equal(initiations,1);
      await assert.rejects(()=>service.startPayment(easyTerms.id,{phone:'03001234567',email:'fixture@example.test'}));
      globalThis.fetch=async()=>Response.json({orderId:easyTerms.id,storeId:'999',accountNum:'456',transactionAmount:'1000',paymentMode:'MA',transactionStatus:'PAID',responseCode:'0000'});
      await assert.rejects(()=>providers.inquireEasypaisa(easyTerms,easy));
      assert.equal((await db.select().from(schema.feePayments)).length,0);
    });
    await t.test('returning from a wallet verifies promptly without initiating a second payment',async()=>{
      const next=await invoice();
      const pending=await service.createPaymentAttempt({...target,invoiceId:next.id},'easypaisa');
      let inquiries=0,initiations=0;
      globalThis.fetch=async(input,init)=>{
        const body=JSON.parse(String(init?.body));
        if(String(input).endsWith('initiate-ma-transaction')) { initiations++; return Response.json({orderId:body.orderId,storeId:'123',responseCode:'0000'}); }
        inquiries++;
        return Response.json({orderId:body.orderId,storeId:'123',accountNum:'456',transactionAmount:'1000.00',paymentMode:'MA',transactionStatus:inquiries===1?'PENDING':'PAID',responseCode:'0000',transactionId:'EP-RETURN'});
      };
      await service.startPayment(pending.id,{phone:'03001234567',email:'fixture@example.test'});
      assert.equal((await service.getPaymentAttempt(pending.id)).status,'PENDING');
      assert.equal(inquiries,1);
      await db.update(schema.gatewayPaymentAttempts).set({lastCheckedAt:new Date(Date.now()-2500)}).where(eq(schema.gatewayPaymentAttempts.id,pending.id));
      await service.refreshPayment(pending.id);
      assert.equal(inquiries,1,'Ordinary polls retain their five-second throttle');
      await service.refreshPayment(pending.id,true);
      assert.equal((await service.getPaymentAttempt(pending.id)).status,'PAID');
      assert.equal(inquiries,2);
      assert.equal(initiations,1,'Foreground return performs inquiry, never another debit');
      await service.refreshPayment(pending.id,true);
      assert.equal(inquiries,2,'Confirmed receipts do not poll the provider again');
      globalThis.fetch=originalFetch;
    });
    await t.test('endpoint allowlist rejects redirects/custom hosts and wrong protocol versions',async()=>{
      const previous=process.env.EASYPAISA_SANDBOX_INQUIRY_URL;
      for(const url of ['http://easypaystg.easypaisa.com.pk/private','https://attacker.test/easypay-service/rest/v4/inquire-transaction','https://easypayst.easypaisa.com.pk/easypay-service/rest/v5/inquire-transaction']){
        process.env.EASYPAISA_SANDBOX_INQUIRY_URL=url;assert.throws(()=>endpoints.gatewayEndpoint('easypaisa','sandbox','inquiry'));
      }process.env.EASYPAISA_SANDBOX_INQUIRY_URL=previous;
    });
    await t.test('signed browser callback rejects duplicate fields and preserves payer portal on valid retry',async()=>{
      const route=await load<typeof import('../src/app/api/payments/jazzcash/return/route')>('src/app/api/payments/jazzcash/return/route.ts');
      const valid=new URLSearchParams(fields(attempt)).toString();
      const request=(body:string)=>new NextRequest('https://example.test/api/payments/jazzcash/return',{method:'POST',body,headers:{'Content-Type':'application/x-www-form-urlencoded'}});
      assert.equal((await route.POST(request(valid+'&pp_Amount=1'))).status,400);
      assert.equal((await route.POST(request(valid.replace(/pp_SecureHash=[^&]+/,'pp_SecureHash=bad')))).status,400);
      const response=await route.POST(request(valid));assert.equal(response.status,303);
      assert.equal(response.headers.get('location'),`https://student.example.test/payments/${attempt.id}`);
      assert.equal((await db.select().from(schema.feePayments)).length,0);
    });
    await t.test('SOAP callback accepts signed local contract, rejects tampering and XML entities',async()=>{
      const route=await load<typeof import('../src/app/api/webhooks/jazzcash/soap/route')>('src/app/api/webhooks/jazzcash/soap/route.ts');
      const xml=(values:Record<string,string>)=>`<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"><soap:Body><UpdatePaymentStatus>${Object.entries(values).map(([key,value])=>`<${key}>${value}</${key}>`).join('')}</UpdatePaymentStatus></soap:Body></soap:Envelope>`;
      const request=(body:string)=>new NextRequest('https://example.test/api/webhooks/jazzcash/soap',{method:'POST',body});
      assert.equal((await route.POST(request(xml({...fields(attempt),pp_Amount:'1'})))).status,500);
      assert.equal((await route.POST(request('<!DOCTYPE x [<!ENTITY e SYSTEM "file:///etc/passwd">]>'+xml(fields(attempt))))).status,500);
      const response=await route.POST(request(xml(fields(attempt))));assert.equal(response.status,200);assert.match(await response.text(),/UpdatePaymentStatusResult>000Success/);
    });
    await t.test('Manual switch blocks new initiation and proof overlap but preserves signed late settlement',async()=>{
      const next=await invoice();const pending=await legacyAttempt(next.id);
      await db.update(schema.gatewayPaymentAttempts).set({initiationStartedAt:new Date()}).where(eq(schema.gatewayPaymentAttempts.id,pending.id));
      await config.updatePaymentConfig(root.id,{action:'mode',mode:'MANUAL'});
      await assert.rejects(()=>service.createPaymentAttempt(target,'jazzcash'));
      const manual=await load<typeof import('../src/lib/payments/manual-mode')>('src/lib/payments/manual-mode.ts');
      await assert.rejects(()=>db.transaction(tx=>manual.assertManualPayment(tx as never,root.id,{invoiceId:next.id})));
      await service.settlePayment(pending.id,providers.verifyJazzCash(fields(pending,'RRN-LATE-MODE'),pending,jazz));
      assert.equal((await service.getPaymentAttempt(pending.id)).status,'PAID');
      await config.updatePaymentConfig(root.id,{action:'mode',mode:'ONLINE'});
    });
    await t.test('disabling a gateway blocks initiation of an already prepared checkout',async()=>{
      const next=await invoice();const pending=await legacyAttempt(next.id);
      await config.updatePaymentConfig(root.id,{action:'gateway',gateway:'jazzcash',enabled:false,environment:'sandbox',credentials:{}});
      await assert.rejects(()=>service.startPayment(pending.id,{phone:'',email:''}));
      assert.equal((await service.getPaymentAttempt(pending.id)).initiationStartedAt,null);
      await config.updatePaymentConfig(root.id,{action:'gateway',gateway:'jazzcash',enabled:true,environment:'sandbox',credentials:{}});
    });
    async function productionAttempt(invoiceId:number){
      const id='N'+Math.random().toString(36).slice(2,16).toUpperCase();
      return (await db.insert(schema.gatewayPaymentAttempts).values({id,institutionId:root.id,invoiceId,gateway:'jazzcash',environment:'production',merchantId:jazz.merchantId,
        amount:1000,credentialsEncrypted:service.credentialSnapshot({enabled:true,environment:'production',credentials:jazz}),returnUrl:'https://example.test/api/payments/jazzcash/return',
        institutionName:root.name,payerName:student.name,description:'Fixture',expiresAt:new Date(Date.now()+100000)}).returning())[0];
    }
    await t.test('production settlement posts one ledger receipt; duplicate delivery is harmless',async()=>{
      const next=await invoice();const production=await productionAttempt(next.id);const evidence=providers.verifyJazzCash(fields(production,'RRN-PROD'),production,jazz);
      await service.settlePayment(production.id,evidence);await service.settlePayment(production.id,evidence);
      assert.equal((await db.select().from(schema.feePayments).where(eq(schema.feePayments.invoiceId,next.id))).length,1);
      assert.equal((await db.select().from(schema.feeInvoices).where(eq(schema.feeInvoices.id,next.id)))[0].paidAmount,1000);
    });
    await t.test('late payment after balance changes creates REVIEW receipt without double credit',async()=>{
      const next=await invoice();const production=await productionAttempt(next.id);
      await db.update(schema.feeInvoices).set({paidAmount:500,status:'PARTIAL'}).where(eq(schema.feeInvoices.id,next.id));
      const result=await service.settlePayment(production.id,providers.verifyJazzCash(fields(production,'RRN-LATE'),production,jazz));
      assert.equal(result?.status,'REVIEW');assert.equal((await db.select().from(schema.feePayments).where(eq(schema.feePayments.invoiceId,next.id))).length,0);
    });
    await t.test('reusing a provider reference rolls back the entire second posting',async()=>{
      const next=await invoice();const production=await productionAttempt(next.id);
      await assert.rejects(()=>service.settlePayment(production.id,providers.verifyJazzCash(fields(production,'RRN-PROD'),production,jazz)));
      assert.equal((await db.select().from(schema.feeInvoices).where(eq(schema.feeInvoices.id,next.id)))[0].paidAmount,0);
      assert.equal((await db.select().from(schema.feePayments).where(eq(schema.feePayments.invoiceId,next.id))).length,0);
    });
    await t.test('admission payment uses the same verified attempt/receipt and updates both fee and application',async()=>{
      const [cycle]=await db.insert(schema.admissionCycles).values({institutionId:root.id,name:'Intake',academicYear:'2026',status:'OPEN'}).returning();
      const [offering]=await db.insert(schema.admissionOfferings).values({institutionId:root.id,cycleId:cycle.id,title:'Class A'}).returning();
      const [account]=await db.insert(schema.admissionApplicantAccounts).values({institutionId:root.id,guardianEmail:'guardian@example.test',passwordHash:'fixture'}).returning();
      const [application]=await db.insert(schema.admissionApplications).values({institutionId:root.id,intakeInstitutionId:root.id,campusId:campus.id,campusName:'Main',cycleId:cycle.id,offeringId:offering.id,
        applicantId:account.id,applicationNumber:'APP-FIXTURE',studentName:'Applicant',dateOfBirth:'2010-01-01',gender:'MALE',guardianName:'Guardian',guardianEmail:'guardian@example.test',guardianPhone:'03001234567',status:'FEE_PENDING'}).returning();
      await db.insert(schema.admissionFeePayments).values({institutionId:root.id,applicationId:application.id,amount:1000,instructions:'Pay online'});
      const [production]=await db.insert(schema.gatewayPaymentAttempts).values({id:'NADMISSIONFIXTURE',institutionId:root.id,applicationId:application.id,gateway:'jazzcash',environment:'production',merchantId:jazz.merchantId,
        amount:1000,credentialsEncrypted:service.credentialSnapshot({enabled:true,environment:'production',credentials:jazz}),returnUrl:'https://example.test/api/payments/jazzcash/return',institutionName:root.name,payerName:'Applicant',description:'Admission',expiresAt:new Date(Date.now()+100000)}).returning();
      await service.settlePayment(production.id,providers.verifyJazzCash(fields(production,'RRN-ADMISSION'),production,jazz));
      assert.equal((await db.select().from(schema.admissionFeePayments).where(eq(schema.admissionFeePayments.applicationId,application.id)))[0].status,'VERIFIED');
      assert.equal((await db.select().from(schema.admissionApplications).where(eq(schema.admissionApplications.id,application.id)))[0].status,'FEE_VERIFIED');
    });
  }finally{globalThis.fetch=originalFetch;await memory.close();delete (globalThis as {__onlinePaymentFixture?:unknown}).__onlinePaymentFixture;}
});
