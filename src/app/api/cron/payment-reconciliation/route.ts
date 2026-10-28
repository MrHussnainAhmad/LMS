import { NextRequest,NextResponse } from 'next/server';
import { timingSafeEqual } from '@/lib/auth';
import { and,eq,isNull,sql } from 'drizzle-orm';
import { db } from '@/db';
import { gatewayPaymentAttempts as attempts } from '@/db/schema';
import { refreshPayment } from '@/lib/payments/service';
export async function POST(req:NextRequest) {
  const secret=process.env.CRON_SECRET;
  if(!secret||!timingSafeEqual(req.headers.get('authorization')||'',`Bearer ${secret}`))return NextResponse.json({error:'Unauthorized'},{status:401});
  const rows=await db.select({id:attempts.id}).from(attempts).where(and(eq(attempts.gateway,'easypaisa'),eq(attempts.status,'PENDING'),isNull(attempts.closedAt),
    sql`${attempts.initiationStartedAt} IS NOT NULL`,sql`${attempts.createdAt}>(now() AT TIME ZONE 'UTC')-interval '7 days'`)).orderBy(sql`${attempts.lastCheckedAt} ASC NULLS FIRST`).limit(12);
  let checked=0,unconfirmed=0;
  for(let index=0;index<rows.length;index+=3)await Promise.all(rows.slice(index,index+3).map(async row=>{try{await refreshPayment(row.id);checked++;}catch{unconfirmed++;}}));
  return NextResponse.json({checked,unconfirmed},{headers:{'Cache-Control':'no-store'}});
}
