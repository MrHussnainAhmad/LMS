import { jwtVerify } from 'jose';
import { cookies } from 'next/headers';
import { UserRole, JWTPayload } from './auth-types'; // We'll move types here

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || 'fallback-secret-key-12345');

const jwtKeyPromise = crypto.subtle.importKey(
  'raw',
  JWT_SECRET,
  { name: 'HMAC', hash: 'SHA-256' },
  false,
  ['sign', 'verify']
);

export async function verifyAccessToken(token: string): Promise<JWTPayload | null> {
  try {
    const key = await jwtKeyPromise;
    const { payload } = await jwtVerify(token, key, { algorithms: ['HS256'] });
    return payload as unknown as JWTPayload;
  } catch (err) {
    return null;
  }
}

export async function getSessionEdge(requestCookies: any): Promise<JWTPayload | null> {
  const token = requestCookies.get('access_token')?.value;
  if (!token) return null;
  return await verifyAccessToken(token);
}
