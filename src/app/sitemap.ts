export const dynamic = 'force-dynamic';
import { MetadataRoute } from 'next'
import { db } from "@/db";
import { platformPages, blogs } from "@/db/schema";
 
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const pages = await db.select({ slug: platformPages.slug, updatedAt: platformPages.updatedAt }).from(platformPages);
  const allBlogs = await db.select({ slug: blogs.slug, updatedAt: blogs.updatedAt }).from(blogs);
  
  const dynamicRoutes = pages.map((page) => ({
    url: `https://nisaab360.app/${page.slug}`,
    lastModified: page.updatedAt || new Date(),
    changeFrequency: 'weekly' as const,
    priority: 0.8,
  }));

  const blogRoutes = allBlogs.map((blog) => ({
    url: `https://nisaab360.app/blog/${blog.slug}`,
    lastModified: blog.updatedAt || new Date(),
    changeFrequency: 'weekly' as const,
    priority: 0.7,
  }));

  return [
    {
      url: 'https://nisaab360.app',
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 1,
    },
    {
      url: 'https://nisaab360.app/blog',
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 0.9,
    },
    {
      url: 'https://nisaab360.app/login',
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.8,
    },
    {
      url: 'https://nisaab360.app/register',
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.8,
    },
    {
      url: 'https://nisaab360.app/lms-pakistan',
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.9,
    },
    ...dynamicRoutes,
    ...blogRoutes,
  ]
}
