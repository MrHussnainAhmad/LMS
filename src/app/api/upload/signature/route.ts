import { NextResponse } from 'next/server';
import cloudinary from '@/lib/cloudinary';
import { requireRole } from '@/lib/rbac';

export const POST = requireRole(['STUDENT', 'STAFF', 'INSTITUTION', 'SUPER_ADMIN'], async () => {
  try {
    const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME || process.env.CLOUDINARY_CLOUD_NAME;
    const apiKey = process.env.CLOUDINARY_API_KEY;
    const apiSecret = process.env.CLOUDINARY_API_SECRET;

    if (!cloudName || !apiKey || !apiSecret) {
      return NextResponse.json(
        { error: 'Cloudinary is not configured on the server' },
        { status: 500 }
      );
    }

    const timestamp = Math.round(new Date().getTime() / 1000);
    
    // Cloudinary signature generation
    const signature = cloudinary.utils.api_sign_request(
      {
        timestamp: timestamp,
        folder: 'lms-uploads',
      },
      apiSecret
    );

    return NextResponse.json({
      signature,
      timestamp,
      cloudName,
      apiKey,
    });
  } catch (err) {
    console.error('Cloudinary Signature Error:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
});
