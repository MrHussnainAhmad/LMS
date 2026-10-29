import { and, eq, sql } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/db';
import { institutionPaymentGateways as settings, feePaymentSubmissions, admissionFeePayments } from '@/db/schema';
import { decryptStreamingCredentials, encryptStreamingCredentials } from '@/lib/streaming-credentials';
import { endpointsReady } from './endpoints';

export const GATEWAYS = ['jazzcash', 'easypaisa'] as const;
export type GatewayId = typeof GATEWAYS[number];
export type PaymentMode = 'MANUAL' | 'ONLINE';
export type GatewayConfig = { enabled: boolean; environment: 'sandbox' | 'production'; credentials: Record<string,string> };
export type PaymentConfig = { mode: PaymentMode; gateways: Partial<Record<GatewayId,GatewayConfig>> };
export type PaymentExecutor = Parameters<Parameters<typeof db.transaction>[0]>[0];
export class PaymentError extends Error {
  constructor(message: string, readonly status = 400) { super(message); }
}
export const gatewayId = z.enum(GATEWAYS);
const credentialSchemas = {
  jazzcash: z.object({merchantId:z.string().trim().min(1).max(160),password:z.string().min(1).max(256),integritySalt:z.string().min(1).max(256)}).strict(),
  easypaisa: z.object({storeId:z.string().regex(/^\d{1,18}$/),accountNum:z.string().regex(/^\d{1,32}$/),username:z.string().trim().min(1).max(160),password:z.string().min(1).max(256)}).strict(),
};
export function productionApproved(gateway: GatewayId) {
  return (process.env.PAYMENT_VERIFIED_GATEWAYS ?? '').split(',').map(value=>value.trim()).includes(gateway);
}
export async function readPaymentConfig(institutionId: number, executor: PaymentExecutor | typeof db = db, lock = false): Promise<PaymentConfig> {
  const query = executor.select().from(settings).where(eq(settings.institutionId,institutionId)).limit(1);
  const [row] = await (lock ? query.for('share') : query);
  const encoded = decryptStreamingCredentials(row?.credentialsEncrypted)?.paymentConfigV1;
  let gateways: PaymentConfig['gateways'] = {};
  if(encoded) {
    try {
      const parsed=JSON.parse(encoded);
      for(const id of GATEWAYS) {
        const value=parsed[id];
        if(value && typeof value.enabled==='boolean' && ['sandbox','production'].includes(value.environment)
          && credentialSchemas[id].safeParse(value.credentials).success) gateways[id]=value;
      }
    } catch { gateways={}; }
  }
  return {mode:row?.mode === 'ONLINE' ? 'ONLINE' : 'MANUAL',gateways};
}
export function publicPaymentConfig(config: PaymentConfig) {
  return { mode:config.mode,gateways:GATEWAYS.map(id=>{
    const gateway=config.gateways[id];
    const approved=gateway?.environment !== 'production' || productionApproved(id);
    const endpointReady=Boolean(gateway && endpointsReady(id,gateway.environment));
    const notReadyReason=!gateway ? null : !approved
      ? 'Credentials saved. Live payments await platform activation after merchant acceptance testing.'
      : !endpointReady ? 'Credentials saved. The platform administrator must finish the gateway connection setup.'
      : !gateway.enabled ? 'Credentials saved. Enable this gateway to make it available.' : null;
    return {id,configured:Boolean(gateway),enabled:Boolean(gateway?.enabled),environment:gateway?.environment ?? 'sandbox',
      ready:Boolean(gateway?.enabled && approved && endpointReady),notReadyReason,
      merchantId:gateway?.credentials.merchantId ?? gateway?.credentials.storeId ?? '',
      accountNum:gateway?.credentials.accountNum ?? '',username:gateway?.credentials.username ?? ''};
  })};
}
export function encodePaymentConfig(config: PaymentConfig) {
  return encryptStreamingCredentials({paymentConfigV1:JSON.stringify(config.gateways)});
}
export async function updatePaymentConfig(institutionId:number,body:unknown) {
  const request=z.discriminatedUnion('action',[
    z.object({action:z.literal('mode'),mode:z.enum(['MANUAL','ONLINE'])}).strict(),
    z.object({action:z.literal('gateway'),gateway:gatewayId,enabled:z.boolean(),environment:z.enum(['sandbox','production']),
      credentials:z.record(z.string(),z.string().max(256))}).strict(),
  ]).safeParse(body);
  if(!request.success)throw new PaymentError('Enter valid payment settings.');
  return db.transaction(async tx=>{
    // Serialize even the first settings save, when no row exists to lock yet.
    await tx.execute(sql`SELECT pg_advisory_xact_lock(36077,${institutionId})`);
    await tx.select({id:settings.institutionId}).from(settings).where(eq(settings.institutionId,institutionId)).for('update');
    const config=await readPaymentConfig(institutionId,tx);
    const action=request.data;
    if(action.action==='gateway') {
      const previous=config.gateways[action.gateway];
      const identity=action.gateway==='jazzcash'?'merchantId':'storeId';
      const same=previous?.environment===action.environment && (!action.credentials[identity]||previous.credentials[identity]===action.credentials[identity]);
      const credentials={...(same?previous?.credentials:{}),...Object.fromEntries(Object.entries(action.credentials).filter(([,value])=>value!==''))};
      const checked=credentialSchemas[action.gateway].safeParse(credentials);
      if(!checked.success)throw new PaymentError('Provide all merchant credentials. Re-enter secrets when changing merchant or environment.');
      config.gateways[action.gateway]={enabled:action.enabled,environment:action.environment,credentials:checked.data};
    } else {
      if(action.mode==='ONLINE') {
        // Existing submitted proofs remain reviewable; new online attempts must
        // not overlap an unresolved manual submission for the same fee.
        const [proof]=await tx.select({id:feePaymentSubmissions.id}).from(feePaymentSubmissions)
          .where(and(eq(feePaymentSubmissions.institutionId,institutionId),eq(feePaymentSubmissions.status,'SUBMITTED'))).limit(1);
        const [admission]=await tx.select({id:admissionFeePayments.id}).from(admissionFeePayments)
          .where(and(eq(admissionFeePayments.institutionId,institutionId),eq(admissionFeePayments.status,'SUBMITTED'))).limit(1);
        if(proof||admission)throw new PaymentError('Review pending manual payments before enabling Online payments.',409);
      }
      config.mode=action.mode;
    }
    if(config.mode==='ONLINE'&&!publicPaymentConfig(config).gateways.some(gateway=>gateway.ready))throw new PaymentError('Configure and enable at least one gateway before using Online payments.',409);
    const credentialsEncrypted=encodePaymentConfig(config);
    await tx.insert(settings).values({institutionId,mode:config.mode,credentialsEncrypted})
      .onConflictDoUpdate({target:settings.institutionId,set:{mode:config.mode,credentialsEncrypted,updatedAt:new Date()}});
    return publicPaymentConfig(config);
  });
}
