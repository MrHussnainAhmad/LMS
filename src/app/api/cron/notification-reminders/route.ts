import type { NextRequest } from 'next/server';
import { timingSafeEqual } from '@/lib/auth';
import { sendDueNotificationReminders } from '@/lib/notification-reminders';
export const runtime='nodejs';
export async function POST(req:NextRequest){
 const expected=process.env.CRON_SECRET;
 const given=req.headers.get('authorization')?.replace(/^Bearer /i,'') || '';
 if(!expected || !timingSafeEqual(expected,given))return Response.json({error:'Unauthorized'},{status:401});
 return Response.json(await sendDueNotificationReminders(),{headers:{'Cache-Control':'no-store'}});
}
