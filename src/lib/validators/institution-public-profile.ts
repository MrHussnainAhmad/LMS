import { z } from 'zod';

const nullableText = (maximum: number) => z.string().trim().max(maximum).transform((value) => value || null);
const nullableHttpsUrl = (maximum = 500) => z.string().trim().max(maximum).refine((value) => {
  if (!value) return true;
  try { return new URL(value).protocol === 'https:'; } catch { return false; }
}, 'Enter a valid HTTPS URL').transform((value) => value || null);
const nullableLink = z.string().trim().max(500).refine((value) => {
  if (!value || value.startsWith('/')) return true;
  try { return new URL(value).protocol === 'https:'; } catch { return false; }
}, 'Enter a valid page path or HTTPS URL').transform((value) => value || null);
const contentCard = z.object({
  title: z.string().trim().min(1).max(120),
  description: z.string().trim().max(500),
}).strict();

export const institutionPublicProfileSchema = z.object({
  tagline: nullableText(160),
  description: nullableText(2000),
  heroImageUrl: nullableHttpsUrl(),
  announcementText: nullableText(240),
  announcementLink: nullableLink,
  aboutTitle: nullableText(120),
  mission: nullableText(1200),
  vision: nullableText(1200),
  principalName: nullableText(120),
  principalTitle: nullableText(120),
  principalMessage: nullableText(1800),
  principalImageUrl: nullableHttpsUrl(),
  statistics: z.array(z.object({ value: z.string().trim().min(1).max(30), label: z.string().trim().min(1).max(80) }).strict()).max(6),
  programs: z.array(contentCard).max(8),
  highlights: z.array(contentCard).max(8),
  galleryImages: z.array(z.object({ url: nullableHttpsUrl(), caption: z.string().trim().max(120) }).strict()).max(8).transform((items) => items.filter((item): item is { url: string; caption: string } => Boolean(item.url))),
  publicEmail: z.union([
    z.literal(''),
    z.string().trim().email('Enter a valid public email address').max(255),
  ]).transform((value) => value || null),
  publicPhone: z.string().trim().max(50).regex(/^[0-9+() .-]*$/, 'Enter a valid public phone number').transform((value) => value || null),
  publicAddress: nullableText(300),
  mapUrl: nullableHttpsUrl(),
  facebookUrl: nullableHttpsUrl(),
  instagramUrl: nullableHttpsUrl(),
  youtubeUrl: nullableHttpsUrl(),
  accentColor: z.enum(['#233c32', '#1d4ed8', '#7c2d12', '#5b21b6', '#0f766e']),
}).strict();
