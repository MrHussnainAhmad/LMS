import { createHash } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { and, eq, gt, isNull } from 'drizzle-orm';
import { db } from '@/db';
import { pushDevices, refreshTokens, students, staff } from '@/db/schema';
import { getSessionFromRequest } from '@/lib/auth';
import { createNotification } from '@/lib/notification-delivery';
import { withRateLimit } from '@/lib/rate-limit';
import { readJsonBody, AUTH_MAX_BODY_BYTES } from '@/lib/http';
const schema=z.object({token:z.string().max(255).regex(/^(ExpoPushToken|ExponentPushToken)\[[A-Za-z0-9_-]+\]$/),
 projectId:z.string().uuid(),refreshToken:z.string().regex(/^[a-f0-9]{80}$/i),deviceName:z.string().trim().max(120).optional()}).strict();
async function identity(req:NextRequest){const session=await getSessionFromRequest(req);return session?.institutionId && ['STUDENT','STAFF','PARENT'].includes(session.role)?session:null;}
export async function GET(req:NextRequest){
 const session=await identity(req);if(!session)return NextResponse.json({error:'Unauthorized'},{status:401});
 const rows=await db.select({id:pushDevices.id}).from(pushDevices).where(and(eq(pushDevices.userRole,session.role),eq(pushDevices.userId,session.userId),eq(pushDevices.institutionId,session.institutionId!),isNull(pushDevices.revokedAt)));
 let legacy=false;if(!rows.length && session.role!=='PARENT'){const table=session.role==='STUDENT'?students:staff;const [owner]=await db.select({token:table.expoPushToken}).from(table).where(and(eq(table.id,session.userId),eq(table.institutionId,session.institutionId!))).limit(1);legacy=Boolean(owner?.token);}
 return NextResponse.json({hasPushToken:rows.length>0 || legacy},{headers:{'Cache-Control':'no-store'}});
}
export async function POST(req:NextRequest){
 if(!(await withRateLimit(req,'api')).success)return NextResponse.json({error:'Too many requests'},{status:429});
 const session=await identity(req);if(!session)return NextResponse.json({error:'Unauthorized'},{status:401});
 const body=await readJsonBody(req,AUTH_MAX_BODY_BYTES);if(!body.ok)return NextResponse.json({error:body.error},{status:body.status});
 const legacy=body.data as {token?:unknown;projectId?:unknown;refreshToken?:unknown}|null;
 // Preserve existing installed Student/Staff clients during the app rollout.
 if(legacy && typeof legacy.token==='string' && /^(ExpoPushToken|ExponentPushToken)\[[A-Za-z0-9_-]+\]$/.test(legacy.token) && legacy.token.length<=255 && !legacy.projectId && !legacy.refreshToken && session.role!=='PARENT'){
   const table=session.role==='STUDENT'?students:staff;
   await db.update(table).set({expoPushToken:legacy.token}).where(and(eq(table.id,session.userId),eq(table.institutionId,session.institutionId!)));
   return NextResponse.json({success:true,legacy:true});
 }
 const parsed=schema.safeParse(body.data);if(!parsed.success)return NextResponse.json({error:'A valid device token, project and current refresh token are required.'},{status:400});
 const input=parsed.data;
 const sessionTokenHash=createHash('sha256').update(input.refreshToken).digest('hex');
 const [record]=await db.select({id:refreshTokens.id}).from(refreshTokens).where(and(eq(refreshTokens.tokenHash,sessionTokenHash),eq(refreshTokens.userRole,session.role),eq(refreshTokens.userId,session.userId),isNull(refreshTokens.revokedAt),gt(refreshTokens.expiresAt,new Date()))).limit(1);
 if(!record)return NextResponse.json({error:'Session binding changed. Enable notifications again.'},{status:403});
 const [existing]=await db.select({userId:pushDevices.userId,userRole:pushDevices.userRole}).from(pushDevices).where(eq(pushDevices.token,input.token)).limit(1);
 const newDevice=!existing || existing.userId!==session.userId || existing.userRole!==session.role;
 await db.insert(pushDevices).values({institutionId:session.institutionId!,userRole:session.role,userId:session.userId,token:input.token,projectId:input.projectId,sessionTokenHash,deviceName:input.deviceName,revokedAt:null})
 .onConflictDoUpdate({target:pushDevices.token,set:{institutionId:session.institutionId!,userRole:session.role,userId:session.userId,projectId:input.projectId,sessionTokenHash,deviceName:input.deviceName,revokedAt:null,updatedAt:new Date()}});
 if(newDevice)await createNotification({institutionId:session.institutionId!,userRole:session.role as 'STUDENT'|'STAFF'|'PARENT',userId:session.userId,type:'SECURITY',title:'New device signed in',message:`Your account was connected on ${input.deviceName || 'a mobile device'}. Review your account if this was not you.`,eventKey:`device:${sessionTokenHash}`});
 return NextResponse.json({success:true},{headers:{'Cache-Control':'no-store'}});
}
export async function DELETE(req:NextRequest){
 if(!(await withRateLimit(req,'api')).success)return NextResponse.json({error:'Too many requests'},{status:429});
 const session=await identity(req);if(!session)return NextResponse.json({error:'Unauthorized'},{status:401});
 const body=await readJsonBody<{token?:unknown}>(req,AUTH_MAX_BODY_BYTES);
 if(!body.ok || typeof body.data?.token!=='string')return NextResponse.json({error:'Device token required'},{status:400});
 await db.update(pushDevices).set({revokedAt:new Date()}).where(and(eq(pushDevices.token,body.data.token),eq(pushDevices.userRole,session.role),eq(pushDevices.userId,session.userId),eq(pushDevices.institutionId,session.institutionId!)));
 if(session.role!=='PARENT'){const table=session.role==='STUDENT'?students:staff;await db.update(table).set({expoPushToken:null}).where(and(eq(table.id,session.userId),eq(table.institutionId,session.institutionId!),eq(table.expoPushToken,body.data.token)));}
 return NextResponse.json({success:true});
}
