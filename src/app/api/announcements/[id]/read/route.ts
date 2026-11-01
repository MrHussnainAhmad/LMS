import { NextRequest, NextResponse } from 'next/server';
import { getVisibleAnnouncementById, markAnnouncementRead } from '@/lib/announcements';
import { requireRole } from '@/lib/rbac';
import { readBoundedJson } from '@/lib/http';
import { inputErrorResponse } from '@/lib/input-error-response';

export const GET=requireRole(['STUDENT','STAFF','PARENT','INSTITUTION','INSTITUTION_ADMIN'],async(req:NextRequest,{session,params})=>{
  const id=Number((await params).id),studentId=Number(req.nextUrl.searchParams.get('studentId'))||undefined;
  if(!Number.isSafeInteger(id)||id<1)return NextResponse.json({error:'Invalid announcement'},{status:400});
  const notice=await getVisibleAnnouncementById(session,id,studentId);
  return notice?NextResponse.json(notice,{headers:{'Cache-Control':'private, no-store'}}):NextResponse.json({error:'Announcement not found'},{status:404});
});

export const POST=requireRole(['STUDENT','STAFF','PARENT','INSTITUTION','INSTITUTION_ADMIN'],async(req:NextRequest,{session,params})=>{
  const id=Number((await params).id);
  if(!Number.isSafeInteger(id)||id<1)return NextResponse.json({error:'Invalid announcement'},{status:400});
  try{
    const body=req.body?await readBoundedJson(req):{};
    await markAnnouncementRead(session,id,body);
    return NextResponse.json({success:true,notice:await getVisibleAnnouncementById(session,id,body.studentId)});
  }catch(error){
    const input=inputErrorResponse(error);if(input)return NextResponse.json(input.body,{status:input.status});
    return NextResponse.json({error:'Announcement not found'},{status:404});
  }
});
