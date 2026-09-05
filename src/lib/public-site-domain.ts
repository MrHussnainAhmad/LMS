import { db } from '@/db';
import { systemSettings } from '@/db/schema';

let cached: { value: string; expiresAt: number } | null = null;

export async function getPublicSiteBaseDomain(): Promise<string> {
  if (cached && cached.expiresAt > Date.now()) return cached.value;
  try {
    const [settings] = await db.select({ value: systemSettings.publicSiteBaseDomain }).from(systemSettings).limit(1);
    const value = settings?.value?.trim().toLowerCase() || process.env.PUBLIC_SITE_BASE_DOMAIN || 'nisaab360.app';
    cached = { value, expiresAt: Date.now() + 60_000 };
    return value;
  } catch {
    return process.env.PUBLIC_SITE_BASE_DOMAIN || 'nisaab360.app';
  }
}

export function invalidatePublicSiteBaseDomainCache() { cached = null; }
