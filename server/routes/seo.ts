import { Router } from 'express';
import { logger } from '../lib/logger';

const router = Router();

/**
 * GET /sitemap.xml - Dynamic XML sitemap
 * Lists all pages for search engines to crawl
 */
router.get('/sitemap.xml', (req, res) => {
  const baseUrl = process.env.BASE_URL || 'https://petwash.co.il';
  
  const pages = [
    { url: '/', changefreq: 'daily', priority: '1.0' },
    { url: '/about', changefreq: 'monthly', priority: '0.8' },
    { url: '/contact', changefreq: 'monthly', priority: '0.7' },
    { url: '/packages', changefreq: 'weekly', priority: '0.9' },
    { url: '/vouchers', changefreq: 'weekly', priority: '0.8' },
    { url: '/locations', changefreq: 'monthly', priority: '0.8' },
    { url: '/franchise', changefreq: 'monthly', priority: '0.7' },
    { url: '/our-service', changefreq: 'monthly', priority: '0.8' },
    { url: '/gallery', changefreq: 'weekly', priority: '0.6' },
    { url: '/subscriptions', changefreq: 'weekly', priority: '0.7' },
    { url: '/pet-care-planner', changefreq: 'weekly', priority: '0.6' },
    { url: '/signin', changefreq: 'monthly', priority: '0.5' },
    { url: '/signup', changefreq: 'monthly', priority: '0.5' },
    { url: '/privacy', changefreq: 'monthly', priority: '0.4' },
    { url: '/terms', changefreq: 'monthly', priority: '0.4' },
    { url: '/accessibility', changefreq: 'monthly', priority: '0.4' },
  ];

  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xhtml="http://www.w3.org/1999/xhtml">
${pages.map(page => `  <url>
    <loc>${baseUrl}${page.url}</loc>
    <changefreq>${page.changefreq}</changefreq>
    <priority>${page.priority}</priority>
    <xhtml:link rel="alternate" hreflang="he" href="${baseUrl}${page.url}?lang=he"/>
    <xhtml:link rel="alternate" hreflang="en" href="${baseUrl}${page.url}?lang=en"/>
    <xhtml:link rel="alternate" hreflang="x-default" href="${baseUrl}${page.url}"/>
  </url>`).join('\n')}
</urlset>`;

  res.header('Content-Type', 'application/xml');
  res.send(sitemap);
  
  logger.info('Sitemap served', { userAgent: req.headers['user-agent'] });
});

/**
 * GET /robots.txt - Tell search engines what to crawl
 */
router.get('/robots.txt', (req, res) => {
  const baseUrl = process.env.BASE_URL || 'https://petwash.co.il';
  
  const robots = `# Pet Wash™ - Robots.txt
User-agent: *
Allow: /
Disallow: /admin/
Disallow: /ops/
Disallow: /api/
Disallow: /dashboard
Disallow: /settings
Disallow: /inbox
Disallow: /pets
Disallow: /my-wallet
Disallow: /claim-voucher
Disallow: /test-purchase
Disallow: /backend-team
Disallow: /firebase-debug
Disallow: /auth-test
Disallow: /firebase-test

# Special handling for Google
User-agent: Googlebot
Allow: /

# Sitemap location
Sitemap: ${baseUrl}/sitemap.xml

# Crawl delay (be nice to our servers)
Crawl-delay: 1
`;

  res.header('Content-Type', 'text/plain');
  res.send(robots);
  
  logger.info('Robots.txt served', { userAgent: req.headers['user-agent'] });
});

export default router;
