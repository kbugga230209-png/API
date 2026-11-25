import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: '*', allow: '/', disallow: ['/app', '/app/', '/api/', '/auth/'] }],
    sitemap: 'https://bharatbite.vercel.app/sitemap.xml',
  };
}
