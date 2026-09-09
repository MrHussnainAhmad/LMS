import { and, eq, isNull, sql } from 'drizzle-orm';
import { db } from '@/db';
import { admissionCycles, institutionPublicProfiles, institutions } from '@/db/schema';
import {
  institutionTenantCacheKey,
  parseInstitutionHostname,
  validateInstitutionSlug,
} from '@/lib/institution-domain';
import { getCachedOrFetch, redis } from '@/lib/redis';
import { getPublicSiteBaseDomain } from '@/lib/public-site-domain';
import { normalizeWebsiteNotices, type WebsiteNotices } from '@/lib/public-website-notices';

const TENANT_CACHE_TTL_SECONDS = 60;

export type PublicInstitutionTenant = {
  id: number;
  name: string;
  type: 'SCHOOL' | 'COLLEGE' | 'UNIVERSITY';
  publicSlug: string;
  logoKey: string;
  city: string;
  country: string;
  admissionsEnabled: boolean;
  tagline: string | null;
  description: string | null;
  heroImageUrl: string | null;
  announcementText: string | null;
  announcementLink: string | null;
  aboutTitle: string | null;
  mission: string | null;
  vision: string | null;
  principalName: string | null;
  principalTitle: string | null;
  principalMessage: string | null;
  principalImageUrl: string | null;
  statistics: Array<{ value: string; label: string }>;
  programs: Array<{ title: string; description: string }>;
  highlights: Array<{ title: string; description: string }>;
  galleryImages: Array<{ url: string; caption: string }>;
  publicEmail: string | null;
  publicPhone: string | null;
  publicAddress: string | null;
  mapUrl: string | null;
  facebookUrl: string | null;
  instagramUrl: string | null;
  youtubeUrl: string | null;
  websiteNotices: WebsiteNotices;
  accentColor: string;
};

type CachedInstitutionTenant = PublicInstitutionTenant & {
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  publicSiteEnabled: boolean;
};

export type InstitutionTenantResolution =
  | { kind: 'active'; tenant: PublicInstitutionTenant }
  | { kind: 'unavailable' }
  | { kind: 'not_found' };

export async function resolveInstitutionTenant(slugInput: string): Promise<InstitutionTenantResolution> {
  const validation = validateInstitutionSlug(slugInput);
  if (!validation.ok) return { kind: 'not_found' };

  const slug = validation.slug;
  const tenant = await getCachedOrFetch<CachedInstitutionTenant | null>(
    institutionTenantCacheKey(slug),
    TENANT_CACHE_TTL_SECONDS,
    async () => {
      const [row] = await db
        .select({
          id: institutions.id,
          name: institutions.name,
          type: institutions.type,
          publicSlug: institutions.publicSlug,
          logoKey: institutions.logoKey,
          city: institutions.city,
          country: institutions.country,
          admissionsEnabled: sql<boolean>`${institutions.admissionsEnabled} AND EXISTS (
            SELECT 1 FROM ${admissionCycles}
            WHERE ${admissionCycles.institutionId} = ${institutions.id}
              AND ${admissionCycles.status} = 'OPEN'
              AND (${admissionCycles.opensOn} IS NULL OR ${admissionCycles.opensOn} <= CURRENT_DATE)
              AND (${admissionCycles.closesOn} IS NULL OR ${admissionCycles.closesOn} >= CURRENT_DATE)
          )`,
          tagline: institutionPublicProfiles.tagline,
          description: institutionPublicProfiles.description,
          heroImageUrl: institutionPublicProfiles.heroImageUrl,
          announcementText: institutionPublicProfiles.announcementText,
          announcementLink: institutionPublicProfiles.announcementLink,
          aboutTitle: institutionPublicProfiles.aboutTitle,
          mission: institutionPublicProfiles.mission,
          vision: institutionPublicProfiles.vision,
          principalName: institutionPublicProfiles.principalName,
          principalTitle: institutionPublicProfiles.principalTitle,
          principalMessage: institutionPublicProfiles.principalMessage,
          principalImageUrl: institutionPublicProfiles.principalImageUrl,
          statistics: institutionPublicProfiles.statistics,
          programs: institutionPublicProfiles.programs,
          highlights: institutionPublicProfiles.highlights,
          galleryImages: institutionPublicProfiles.galleryImages,
          publicEmail: institutionPublicProfiles.publicEmail,
          publicPhone: institutionPublicProfiles.publicPhone,
          publicAddress: institutionPublicProfiles.publicAddress,
          mapUrl: institutionPublicProfiles.mapUrl,
          facebookUrl: institutionPublicProfiles.facebookUrl,
          instagramUrl: institutionPublicProfiles.instagramUrl,
          youtubeUrl: institutionPublicProfiles.youtubeUrl,
          websiteNotices: institutionPublicProfiles.websiteNotices,
          accentColor: institutionPublicProfiles.accentColor,
          status: institutions.status,
          publicSiteEnabled: institutions.publicSiteEnabled,
        })
        .from(institutions)
        .leftJoin(
          institutionPublicProfiles,
          eq(institutionPublicProfiles.institutionId, institutions.id),
        )
        .where(
          and(
            sql`lower(${institutions.publicSlug}) = ${slug}`,
            isNull(institutions.deletedAt),
          ),
        )
        .limit(1);

      if (!row || !row.publicSlug) return null;
      return {
        ...row,
        publicSlug: row.publicSlug,
        accentColor: row.accentColor || '#233c32',
        statistics: row.statistics || [],
        programs: row.programs || [],
        highlights: row.highlights || [],
        galleryImages: row.galleryImages || [],
        websiteNotices: normalizeWebsiteNotices(row.websiteNotices),
      };
    },
  );

  if (!tenant) return { kind: 'not_found' };
  if (tenant.status !== 'APPROVED' || !tenant.publicSiteEnabled) return { kind: 'unavailable' };

  return {
    kind: 'active',
    tenant: {
      id: tenant.id,
      name: tenant.name,
      type: tenant.type,
      publicSlug: tenant.publicSlug,
      logoKey: tenant.logoKey,
      city: tenant.city,
      country: tenant.country,
      admissionsEnabled: tenant.admissionsEnabled,
      tagline: tenant.tagline,
      description: tenant.description,
      heroImageUrl: tenant.heroImageUrl,
      announcementText: tenant.announcementText,
      announcementLink: tenant.announcementLink,
      aboutTitle: tenant.aboutTitle,
      mission: tenant.mission,
      vision: tenant.vision,
      principalName: tenant.principalName,
      principalTitle: tenant.principalTitle,
      principalMessage: tenant.principalMessage,
      principalImageUrl: tenant.principalImageUrl,
      statistics: tenant.statistics,
      programs: tenant.programs,
      highlights: tenant.highlights,
      galleryImages: tenant.galleryImages,
      publicEmail: tenant.publicEmail,
      publicPhone: tenant.publicPhone,
      publicAddress: tenant.publicAddress,
      mapUrl: tenant.mapUrl,
      facebookUrl: tenant.facebookUrl,
      instagramUrl: tenant.instagramUrl,
      youtubeUrl: tenant.youtubeUrl,
      websiteNotices: normalizeWebsiteNotices(tenant.websiteNotices),
      accentColor: tenant.accentColor,
    },
  };
}

export async function resolveInstitutionTenantFromHost(host: string): Promise<InstitutionTenantResolution> {
  const parsed = parseInstitutionHostname(host, await getPublicSiteBaseDomain());
  if (parsed.kind !== 'institution') return { kind: 'not_found' };
  return resolveInstitutionTenant(parsed.slug);
}

export async function invalidateInstitutionTenantCache(slug: string): Promise<void> {
  const validation = validateInstitutionSlug(slug);
  if (!validation.ok || redis.status !== 'ready') return;

  try {
    await redis.del(institutionTenantCacheKey(validation.slug));
  } catch (error) {
    console.warn(`Tenant cache invalidation error for ${validation.slug}:`, error);
  }
}
