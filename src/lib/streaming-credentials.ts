import crypto from 'node:crypto';

type Key = { id: string; secret: string };
function current(): Key {
  const secret = process.env.STREAMING_CREDENTIALS_SECRET || (process.env.NODE_ENV !== 'production' ? process.env.JWT_SECRET : undefined);
  const id = process.env.STREAMING_CREDENTIALS_KEY_ID || 'primary';
  if (!secret || secret.length < 32 || !/^[A-Za-z0-9_-]{1,32}$/.test(id)) throw new Error('A dedicated credential encryption key is required');
  if (process.env.NODE_ENV === 'production' && secret === process.env.JWT_SECRET) throw new Error('Credential encryption and JWT signing keys must differ');
  return { id, secret };
}
function previous(): Key[] {
  const values: unknown = JSON.parse(process.env.STREAMING_CREDENTIALS_PREVIOUS_KEYS || '[]');
  if (!Array.isArray(values) || values.length > 8 || values.some(k => !k || typeof k.id !== 'string' || typeof k.secret !== 'string' || k.secret.length < 32)) throw new Error('Invalid credential keyring');
  return values;
}
const key = (secret: string) => crypto.createHash('sha256').update(secret).digest();
export function encryptStreamingCredentials(value: Record<string,string>) {
  const active = current(), iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key(active.secret), iv);
  cipher.setAAD(Buffer.from('nisaab360:credentials:v2:' + active.id));
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(value), 'utf8'), cipher.final()]);
  return ['v2', active.id, iv.toString('base64url'), cipher.getAuthTag().toString('base64url'), encrypted.toString('base64url')].join('.');
}
export function hasStreamingCredentials(value: string | null | undefined) { return Boolean(value && /^(v1|v2)\./.test(value)); }
export function decryptStreamingCredentials(value: string | null | undefined): Record<string,string> | null {
  if (!value) return null;
  try {
    const parts = value.split('.'), version = parts[0];
    if (!['v1','v2'].includes(version) || parts.length !== (version === 'v2' ? 5 : 4)) return null;
    const active = current(), keys = [active, ...previous()];
    const id = version === 'v2' ? parts[1] : undefined;
    const [iv, tag, data] = parts.slice(version === 'v2' ? 2 : 1).map(v => Buffer.from(v, 'base64url'));
    if (iv.length !== 12 || tag.length !== 16) return null;
    // Legacy JWT-derived records remain readable during explicit key migration.
    const candidates = id ? keys.filter(k => k.id === id).map(k => k.secret) : [...keys.map(k => k.secret), process.env.STREAMING_CREDENTIALS_LEGACY_SECRET, process.env.JWT_SECRET].filter((v): v is string => Boolean(v));
    for (const secret of new Set(candidates)) {
      try {
        const decipher = crypto.createDecipheriv('aes-256-gcm', key(secret), iv);
        if (id) decipher.setAAD(Buffer.from('nisaab360:credentials:v2:' + id));
        decipher.setAuthTag(tag);
        const parsed = JSON.parse(Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8'));
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
        return Object.fromEntries(Object.entries(parsed).filter((e): e is [string,string] => typeof e[1] === 'string'));
      } catch { /* Try the next legacy key without exposing material. */ }
    }
  } catch { return null; }
  return null;
}
