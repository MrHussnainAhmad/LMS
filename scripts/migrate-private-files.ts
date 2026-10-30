// Explicit storage migration. No .env is loaded. Never run against production without an approved rollout.
import pg from 'pg';
import { v2 as cloudinary } from 'cloudinary';
const encode = (publicId: string, resourceType: string, format: string) => 'private-file:v1:' + Buffer.from(JSON.stringify({publicId,resourceType,format})).toString('base64url');
async function main() {
  if (!process.argv.includes('--apply')) { console.log('Plan: move assignment/submission assets from upload to authenticated delivery, invalidate old URLs, and store private descriptors. Use --apply to connect.'); return; }
  const cloud = process.env.CLOUDINARY_CLOUD_NAME || process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
  if (!cloud || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET || !process.env.DIRECT_URL) throw Error('Operator database and Cloudinary configuration required');
  cloudinary.config({ cloud_name:cloud, api_key:process.env.CLOUDINARY_API_KEY, api_secret:process.env.CLOUDINARY_API_SECRET, secure:true });
  const client = new pg.Client({ connectionString: process.env.DIRECT_URL });
  let count = 0;
  async function protect(publicId: string, type: 'image'|'raw') {
    let resource;
    try { resource = await cloudinary.api.resource(publicId, { resource_type:type, type:'authenticated' }); }
    catch {
      resource = await cloudinary.uploader.rename(publicId,publicId,{ resource_type:type, type:'upload', to_type:'authenticated', invalidate:true });
    }
    const format = String(resource.format || publicId.split('.').pop()).toLowerCase();
    if (!['jpg','jpeg','png','webp','pdf','docx','txt'].includes(format)) throw Error('Unsupported legacy asset format');
    return encode(publicId,type,format);
  }
  try {
    await client.connect();
    const assignments = (await client.query("SELECT id,reference_file_url AS value FROM assignments WHERE reference_file_url IS NOT NULL AND reference_file_url NOT LIKE 'private-file:v1:%'")).rows;
    for (const row of assignments) {
      const url = new URL(row.value);
      const match = url.pathname.match(/^\/([^/]+)\/(image|raw)\/upload\/(?:v[0-9]+\/)(.+)$/);
      if (url.hostname !== 'res.cloudinary.com' || !match || match[1] !== cloud) throw Error('Legacy assignment URL needs manual review');
      const type = match[2] as 'image'|'raw';
      const publicId = decodeURIComponent(type === 'image' ? match[3].replace(/\.[^.]+$/, '') : match[3]);
      const stored = await protect(publicId,type);
      await client.query('UPDATE assignments SET reference_file_url=$1 WHERE id=$2 AND reference_file_url=$3',[stored,row.id,row.value]);count++;
    }
    const submissions = (await client.query("SELECT id,file_key,file_url FROM submissions WHERE file_url IS NULL OR file_url NOT LIKE 'private-file:v1:%'")).rows;
    for (const row of submissions) {
      let stored: string | undefined;
      for (const type of ['image','raw'] as const) { try { stored = await protect(row.file_key,type);break; } catch { /* Try the other resource type, then stop safely. */ } }
      if (!stored) throw Error('A legacy submission needs manual review');
      await client.query('UPDATE submissions SET file_url=$1 WHERE id=$2 AND file_key=$3 AND file_url IS NOT DISTINCT FROM $4',[stored,row.id,row.file_key,row.file_url]);count++;
    }
    console.log(`Protected ${count} document records. Verify old original AND transformed URLs reject anonymous requests after CDN invalidation.`);
  } finally { await client.end(); }
}
main().catch(() => { console.error('Private document migration stopped; no asset paths or credentials printed. Review provider configuration and the unconverted records before retrying.'); process.exitCode=1; });
