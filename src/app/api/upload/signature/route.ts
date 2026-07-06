import { NextRequest, NextResponse } from 'next/server';
import cloudinary from '@/lib/cloudinary';
import { requireRole } from '@/lib/rbac';

export const POST = requireRole(['STUDENT', 'STAFF', 'INSTITUTION', 'SUPER_ADMIN'], async (req: NextRequest) => {
  try {
    const timestamp = Math.round(new Date().getTime() / 1000);
    
    // Cloudinary signature generation
    const signature = cloudinary.utils.api_sign_request(
      {
        timestamp: timestamp,
        folder: 'lms-uploads',
      },
      process.env.CLOUDINARY_API_SECRET as string
    );

    return NextResponse.json({
      signature,
      timestamp,
      cloudName: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
      apiKey: process.env.CLOUDINARY_API_KEY,
    });
  } catch (err) {
    console.error('Cloudinary Signature Error:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
});
