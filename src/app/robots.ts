import { MetadataRoute } from 'next'
 
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: ['/', '/login', '/register', '/lms-pakistan', '/blog'],
      disallow: ['/admin', '/sa', '/employee', '/student', '/institution', '/staff', '/employee-login', '/institution-login', '/login/super-admin'],
    },
    sitemap: 'https://nisaab360.app/sitemap.xml',
  }
}
