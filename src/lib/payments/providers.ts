import { createHmac, timingSafeEqual } from 'node:crypto';
import type { GatewayConfig, GatewayId } from './config';
import { gatewayEndpoint, providerJson } from './endpoints';

export type PaymentTerms={id:string;merchantId:string;amount:number;currency:string;environment:'sandbox'|'production';returnUrl:string;createdAt:Date;expiresAt:Date};
export type PaymentEvidence={paid:boolean;reference:string;responseCode:string;digest:string;closed?:boolean};
export function jazzCashHash(fields:Record<string,string>,salt:string) {
  const values=Object.keys(fields).filter(key=>/^pp/i.test(key)&&key.toLowerCase()!=='pp_securehash'&&fields[key]!=='').sort().map(key=>fields[key]);
  return createHmac('sha256',Buffer.from(salt,'utf8')).update([salt,...values].join('&'),'utf8').digest('hex').toUpperCase();
}
export function verifyJazzCash(fields:Record<string,string>,terms:PaymentTerms,credentials:Record<string,string>):PaymentEvidence {
  const supplied=fields.pp_SecureHash;
  if(!/^[0-9a-f]{64}$/i.test(supplied||''))throw new Error('Invalid signature');
  const expected=jazzCashHash(fields,credentials.integritySalt);
  if(!timingSafeEqual(Buffer.from(supplied.toUpperCase()),Buffer.from(expected)))throw new Error('Invalid signature');
  if(fields.pp_TxnRefNo!==terms.id||fields.pp_MerchantID!==terms.merchantId||fields.pp_TxnCurrency!=='PKR'
    || !/^\d+$/.test(fields.pp_Amount||'')||Number(fields.pp_Amount)!==terms.amount*100)throw new Error('Payment terms do not match');
  const paid=fields.pp_ResponseCode==='000';
  const reference=fields.pp_RetreivalReferenceNo;
  if(paid&&(!reference||reference.length>120))throw new Error('Missing provider reference');
  // An unsigned/declined browser return never closes an ambiguous attempt.
  return {paid,reference:reference||'',responseCode:fields.pp_ResponseCode||'',digest:expected};
}
function pakistanTimestamp(date:Date){return new Date(date.getTime()+5*60*60*1000).toISOString().slice(0,19).replace(/[-:T]/g,'');}
export function jazzCashCheckout(terms:PaymentTerms,credentials:Record<string,string>) {
  const fields:Record<string,string>={pp_Version:'1.1',pp_TxnType:'MWALLET',pp_Language:'EN',pp_MerchantID:credentials.merchantId,
    pp_Password:credentials.password,pp_TxnRefNo:terms.id,pp_Amount:String(terms.amount*100),pp_TxnCurrency:'PKR',
    pp_TxnDateTime:pakistanTimestamp(terms.createdAt),pp_TxnExpiryDateTime:pakistanTimestamp(terms.expiresAt),
    pp_BillReference:terms.id,pp_Description:'Nisaab360 fee',pp_ReturnURL:terms.returnUrl};
  fields.pp_SecureHash=jazzCashHash(fields,credentials.integritySalt);
  return {url:gatewayEndpoint('jazzcash',terms.environment,'checkout'),fields};
}
function credentialsHeader(credentials:Record<string,string>){return {Credentials:Buffer.from(`${credentials.username}:${credentials.password}`,'utf8').toString('base64')};}
export async function initiateEasypaisa(terms:PaymentTerms,config:GatewayConfig,payer:{phone:string;email:string}) {
  const value=await providerJson(gatewayEndpoint('easypaisa',terms.environment,'initiate'),{
    orderId:terms.id,storeId:config.credentials.storeId,transactionAmount:terms.amount.toFixed(2),transactionType:'MA',
    mobileAccountNo:payer.phone,emailAddress:payer.email,
  },credentialsHeader(config.credentials));
  // Initiation is never proof of settlement. Inquiry verifies the full amount.
  if(value.orderId!==terms.id||String(value.storeId)!==config.credentials.storeId)throw new Error('Initiation identity mismatch');
  return {accepted:value.responseCode==='0000'};
}
export async function inquireEasypaisa(terms:PaymentTerms,credentials:Record<string,string>):Promise<PaymentEvidence> {
  const value=await providerJson(gatewayEndpoint('easypaisa',terms.environment,'inquiry'),{orderId:terms.id,storeId:credentials.storeId,accountNum:credentials.accountNum},credentialsHeader(credentials),10000);
  if(value.responseCode!=='0000')throw new Error('Inquiry not confirmed');
  const amount=String(value.transactionAmount);
  if(value.orderId!==terms.id||String(value.storeId)!==terms.merchantId||String(value.accountNum)!==credentials.accountNum
    || !/^\d+(?:\.\d{1,2})?$/.test(amount)||Number(amount)!==terms.amount||value.paymentMode!=='MA')throw new Error('Inquiry terms do not match');
  const paid=value.transactionStatus==='PAID';
  // Inquiry does not always contain a separate EWP ID; the authenticated
  // merchant/store/order identity is the provider's unique order reference.
  const reference=String(value.transactionId||terms.id);
  if(reference.length>120)throw new Error('Invalid provider reference');
  return {paid,reference,responseCode:String(value.transactionStatus),digest:createHmac('sha256',credentials.password).update(JSON.stringify(value)).digest('hex'),
    closed:['FAILED','BLOCKED','EXPIRED','REVERSED'].includes(String(value.transactionStatus))};
}
export function gatewayName(id:GatewayId){return id==='jazzcash'?'JazzCash':'Easypaisa';}
