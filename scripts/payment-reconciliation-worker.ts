import { setTimeout } from 'node:timers/promises';
const controller=new AbortController();
for(const event of ['SIGTERM','SIGINT'] as const)process.on(event,()=>controller.abort());
async function main() {
  const secret=process.env.CRON_SECRET;
  if(!secret)throw new Error('CRON_SECRET is required');
  const origin=process.env.PAYMENT_INTERNAL_ORIGIN||'http://app:3000';
  const url=new URL('/api/cron/payment-reconciliation',origin);
  if(!['app','127.0.0.1','localhost'].includes(url.hostname))throw new Error('Reconciliation must use the private application network');
  while(!controller.signal.aborted) {
    try {
      const response=await fetch(url,{method:'POST',redirect:'error',headers:{Authorization:`Bearer ${secret}`},
        signal:AbortSignal.any([controller.signal,AbortSignal.timeout(55000)])});
      if(!response.ok)console.error('[payment-reconciliation] Request failed');
      await response.body?.cancel();
    }catch{if(!controller.signal.aborted)console.error('[payment-reconciliation] Service is not available');}
    try{await setTimeout(60000,undefined,{signal:controller.signal});}catch{break;}
  }
}
main().catch(()=>{console.error('[payment-reconciliation] Worker configuration is invalid');process.exitCode=1;});
