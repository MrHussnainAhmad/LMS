import 'server-only';
import cloudinary from './cloudinary';
import { ActionInputError } from './action-input-error';
import type { JWTPayload } from './auth-types';
import { ownsUploadPublicId } from './upload-ownership';
const MAX_SUBMISSION_BYTES = 5 * 1024 * 1024;
const ALLOWED_SUBMISSION_FORMATS = new Set(['pdf','docx','txt','jpg','jpeg','png','webp']);
export async function verifyCloudinarySubmission(fileKey: string, session: JWTPayload) {
  if (!fileKey || fileKey.includes("://") || !ownsUploadPublicId(session, fileKey)) {
    throw new ActionInputError("Invalid uploaded file reference");
  }

  const resource = await getCloudinaryResource(fileKey);
  if (resource.type !== "authenticated") throw new ActionInputError("Private file delivery is required");
  const bytes = Number(resource.bytes || 0);
  const format = String(resource.format || resource.public_id.split(".").pop() || "").toLowerCase();

  if (bytes <= 0 || bytes > MAX_SUBMISSION_BYTES) {
    throw new ActionInputError("Uploaded file exceeds the allowed size");
  }
  if (!ALLOWED_SUBMISSION_FORMATS.has(format)) {
    throw new ActionInputError("Uploaded file type is not allowed");
  }
  return { ...resource, secure_url: encodePrivateFile(resource.public_id, resource.resource_type, format) };
}

async function getCloudinaryResource(publicId: string) {
  for (const resourceType of ["image", "raw"] as const) {
    try {
      return await cloudinary.api.resource(publicId, { resource_type: resourceType, type: "authenticated" });
    } catch {
      // Cloudinary separates images and raw documents; try both before rejecting.
    }
  }
  throw new ActionInputError("Uploaded file could not be verified");
}

// Store descriptors, never an expiring URL or an unsigned public document URL.
const PREFIX = 'private-file:v1:';
export function encodePrivateFile(publicId: string, resourceType: string, format: string) {
  return PREFIX + Buffer.from(JSON.stringify({ publicId, resourceType, format })).toString('base64url');
}
export function privateFileUrl(stored: string | null | undefined): string | null {
  if (!stored?.startsWith(PREFIX)) return null; // Legacy public documents need operator migration.
  try {
    const asset = JSON.parse(Buffer.from(stored.slice(PREFIX.length), 'base64url').toString('utf8'));
    if (typeof asset.publicId !== 'string' || !['image','raw'].includes(asset.resourceType) || !ALLOWED_SUBMISSION_FORMATS.has(asset.format)) return null;
    return cloudinary.utils.private_download_url(asset.publicId, asset.resourceType === 'raw' ? '' : asset.format, {
      resource_type: asset.resourceType, type: 'authenticated', expires_at: Math.floor(Date.now()/1000) + 300, attachment: true,
    });
  } catch { return null; }
}
