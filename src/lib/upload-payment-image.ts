import { uploadPreparedContent } from './client-upload-file';
type UploadTarget = { uploadUrl: string };
export async function uploadPaymentImage(file: File, target: UploadTarget) {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 5 * 1024 * 1024) throw new Error('Choose a JPG, PNG, or WebP image up to 5 MB.');
  const asset = await uploadPreparedContent(file, 'image', undefined, target.uploadUrl);
  if (asset.resource_type !== 'image') throw new Error('Image upload failed.');
  return { publicId: asset.public_id, format: asset.format, resourceType: 'image' as const };
}
