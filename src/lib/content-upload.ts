import { randomUUID } from 'node:crypto';
import type { UploadApiResponse } from 'cloudinary';
import cloudinary from './cloudinary';
import { getCloudinaryConfig } from '@/lib/cloudinary-config';
import { ActionInputError } from './action-input-error';
import { readBoundedFormData, readBoundedJson } from './http';
import { withUploadGrantLimit } from '@/lib/rate-limit';

export const MAX_CONTENT_BYTES = 5 * 1024 * 1024;
const images = ['jpg', 'jpeg', 'png', 'webp'];

export async function readUploadBody(req: Request): Promise<Record<string, unknown>> {
  if (req.headers.get('content-type')?.toLowerCase().startsWith('multipart/form-data')) {
    const form = await readBoundedFormData(req, MAX_CONTENT_BYTES + 16 * 1024);
    return { action: 'upload', file: form.get('file'), purpose: form.get('purpose') || 'image' };
  }
  const body: unknown = await readBoundedJson(req);
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new ActionInputError('Invalid upload request');
  return body as Record<string, unknown>;
}

/** No upload capability leaves the server: actual bytes are bounded first. */
export async function uploadScopedContent(file: unknown, options: { folder: string; privateFile?: boolean; documents?: boolean; identity?: string; formats?: string[] }) {
  if (!(file instanceof File) || file.size < 1 || file.size > MAX_CONTENT_BYTES) throw new ActionInputError('Choose a file no larger than 5 MB');
  const format = file.name.split('.').pop()?.toLowerCase() || '';
  const allowed = options.formats || (options.documents ? [...images, 'pdf', 'docx', 'txt'] : images);
  if (!allowed.includes(format)) throw new ActionInputError('File type is not allowed');
  const quota = await withUploadGrantLimit(options.identity || options.folder);
  if (!quota.success) throw Object.assign(new ActionInputError(quota.unavailable ? 'Uploads are temporarily unavailable' : 'Upload limit reached. Try again later.'), { status: quota.unavailable ? 503 : 429 });
  const config = getCloudinaryConfig();
  if (!config.cloudName || !config.apiKey || !config.apiSecret) throw Object.assign(new ActionInputError('File uploads are not configured'), { status: 503 });
  const resourceType = ['docx', 'txt'].includes(format) ? 'raw' : 'image';
  const publicId = randomUUID() + (resourceType === 'raw' ? `.${format}` : '');
  const type = options.privateFile ? 'authenticated' : 'upload';
  const result = await new Promise<UploadApiResponse>((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream({ folder: options.folder, public_id: publicId, overwrite: false, resource_type: resourceType, type, allowed_formats: allowed, timeout: 30_000 }, (error, response) => error || !response ? reject(error || new Error('Empty upload response')) : resolve(response));
    stream.on('error', reject);
    file.arrayBuffer().then(bytes => stream.end(Buffer.from(bytes))).catch(reject);
  });
  const expectedId = `${options.folder}/${publicId}`;
  const actualFormat = String(result.format || (resourceType === 'raw' ? format : '')).toLowerCase();
  if (result.public_id !== expectedId || result.type !== type || result.resource_type !== resourceType || !Number.isFinite(result.bytes) || result.bytes <= 0 || result.bytes > MAX_CONTENT_BYTES || !allowed.includes(actualFormat) || (!options.privateFile && !result.secure_url?.startsWith('https://'))) {
    await cloudinary.uploader.destroy(expectedId, { resource_type: resourceType, type, invalidate: true }).catch(() => undefined);
    throw new ActionInputError('Uploaded file could not be verified');
  }
  return { public_id: expectedId, resource_type: resourceType, format: actualFormat, secure_url: options.privateFile ? '' : result.secure_url };
}
