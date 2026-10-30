import { randomUUID } from 'node:crypto';
import { inputErrorResponse } from '@/lib/input-error-response';
import { NextResponse } from 'next/server';
import cloudinary from '@/lib/cloudinary';
import { getCloudinaryConfig } from '@/lib/cloudinary-config';
import { requireRole } from '@/lib/rbac';
import { withRateLimit, withUploadGrantLimit } from '@/lib/rate-limit';
import { bodyTooLargeResponse, readJsonBody } from '@/lib/http';
import { ownedUploadFolder } from '@/lib/upload-ownership';

/**
 * The signed `folder` was previously whatever the caller asked for. A signature is
 * a capability: signing an arbitrary folder let any authenticated student mint
 * upload credentials into any namespace (mixing user content into the folders used
 * for institution logos, signatures and proofs), and the route had no rate limit at
 * all, so it doubled as an unmetered way to burn the Cloudinary quota.
 *
 * The server now assigns every account a tenant/role/user namespace. Clients receive
 * that signed folder in the response and cannot request a different destination.
 */
const DOCUMENT_FORMATS = 'jpg,jpeg,png,webp,pdf,docx,txt';

/** The endpoint accepts no client-selected upload parameters. */
const MAX_SIGNATURE_BODY_BYTES = 1024;

export const POST = requireRole(['STUDENT', 'STAFF', 'INSTITUTION', 'INSTITUTION_ADMIN', 'SUPER_ADMIN'], async (req, { session }) => {
  try {
    // Keyed per account rather than per IP so a whole school behind one NAT
    // address is not throttled as a single client.
    const limited = await withRateLimit(req, 'upload', `${session.role}:${session.userId}`);
    if (!limited.success) {
      return NextResponse.json({ error: 'Too many upload requests. Please try again in a moment.' }, { status: 429 });
    }

    const grantLimit = await withUploadGrantLimit(`${session.role}:${session.userId}`);
    if (!grantLimit.success) return NextResponse.json({ error: grantLimit.unavailable ? 'Upload authorization is temporarily unavailable' : 'Upload limit reached. Try again later.' }, { status: grantLimit.unavailable ? 503 : 429 });
    const { cloudName, apiKey, apiSecret } = getCloudinaryConfig();

    if (!cloudName || !apiKey || !apiSecret) {
      const missing = [
        !cloudName && 'CLOUDINARY_CLOUD_NAME (or NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME)',
        !apiKey && 'CLOUDINARY_API_KEY',
        !apiSecret && 'CLOUDINARY_API_SECRET',
      ].filter(Boolean);
      return NextResponse.json(
        { error: `Cloudinary is not configured on the server. Missing: ${missing.join(', ')}. Update the server environment and restart the application.` },
        { status: 503, headers: { 'Cache-Control': 'no-store' } }
      );
    }

    // Most callers POST with no body at all, which is treated as "use the default".
    const body = await readJsonBody<{ folder?: unknown; purpose?: unknown; format?: unknown }>(req, MAX_SIGNATURE_BODY_BYTES);
    if (!body.ok && body.status === 413) return bodyTooLargeResponse();

    if (body.ok && body.data?.folder !== undefined) {
      return NextResponse.json({ error: 'Upload folders are assigned by the server' }, { status: 400 });
    }
    const document = body.ok && body.data?.purpose === 'document';
    const format = body.ok && typeof body.data?.format === 'string' ? body.data.format.toLowerCase() : '';
    const allowedFormats = document ? DOCUMENT_FORMATS : 'jpg,jpeg,png,webp';
    if (document && !allowedFormats.split(',').includes(format)) return NextResponse.json({ error: 'Invalid document format' }, { status: 400 });
    // The provider enforces the byte limit before storing an object, including abandoned uploads.
    const uploadPreset = process.env.CLOUDINARY_CONTENT_UPLOAD_PRESET?.trim();
    if (!uploadPreset) return NextResponse.json({ error: 'Secure upload preset is not configured' }, { status: 503 });
    const preset = await cloudinary.api.upload_preset(uploadPreset);
    const maxBytes = Number(preset.settings?.max_file_size);
    if (preset.unsigned !== false || !Number.isFinite(maxBytes) || maxBytes <= 0 || maxBytes > 5 * 1024 * 1024) return NextResponse.json({ error: 'Upload preset must require signatures and enforce a maximum of 5 MB' }, { status: 503 });
    const folder = ownedUploadFolder(session);
    const publicId = randomUUID() + (['docx','txt'].includes(format) ? '.' + format : '');
    const deliveryType = document ? 'authenticated' : 'upload';

    const timestamp = Math.round(Date.now() / 1000);

    // Cloudinary signature generation
    const signature = cloudinary.utils.api_sign_request(
      {
        timestamp: timestamp,
        folder: folder,
        allowed_formats: allowedFormats,
        public_id: publicId,
        overwrite: false,
        type: deliveryType,
        upload_preset: uploadPreset,
      },
      apiSecret
    );

    return NextResponse.json(
      {
        signature,
        timestamp,
        cloudName,
        apiKey,
        folder,
        allowedFormats,
        publicId,
        overwrite: false,
        deliveryType,
        uploadPreset,
      },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (err) {
    const publicInputError = inputErrorResponse(err);
    if (publicInputError) return NextResponse.json(publicInputError.body, { status: publicInputError.status });

    console.error('Cloudinary Signature Error:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
});
