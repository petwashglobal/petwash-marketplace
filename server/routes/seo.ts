import { Router } from 'express';
import { pool } from '../db';
import { logger } from '../lib/logger';

const router = Router();

// ── Sitemap helpers ─────────────────────────────────────────────────────────

const LANGUAGES = ['he', 'en', 'ar', 'ru', 'fr', 'es'];

function buildUrlEntry(baseUrl: string, url: string, changefreq: string, priority: string): string {
  const hreflangs = LANGUAGES
    .map(lang => `    <xhtml:link rel="alternate" hreflang="${lang}" href="${baseUrl}${url}?lang=${lang}"/>`)
    .join('\n');
  return `  <url>
    <loc>${baseUrl}${url}</loc>
    <changefreq>${changefreq}</changefreq>
    <priority>${priority}</priority>
${hreflangs}
    <xhtml:link rel="alternate" hreflang="x-default" href="${baseUrl}${url}"/>
  </url>`;
}

/** Fetch active station slugs from DB. Never throws — returns [] on any error. */
async function fetchActiveStationSlugs(): Promise<{ slug: string; name: string }[]> {
  try {
    const result = await pool.query(
      `SELECT
         COALESCE(slug, 'station-' || id::text) AS slug,
         name
       FROM stations
       WHERE is_active = true
       ORDER BY name
       LIMIT 500`
    );
    return result.rows;
  } catch (err: any) {
    logger.warn('[SEO] Could not fetch active stations for sitemap', { error: err?.message });
    return [];
  }
}

/**
 * GET /sitemap.xml - Dynamic XML sitemap
 * Includes static pages + all active K9000/wash stations so Google can
 * index every station landing page individually (local SEO boost).
 */
router.get('/sitemap.xml', async (req, res) => {
  const baseUrl = process.env.BASE_URL || 'https://petwash.co.il';

  const staticPages = [
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
    { url: '/sitter-suite', changefreq: 'weekly', priority: '0.8' },
    { url: '/sitter-suite/browse', changefreq: 'daily', priority: '0.8' },
    { url: '/walk-my-pet', changefreq: 'weekly', priority: '0.8' },
    { url: '/pettrek', changefreq: 'weekly', priority: '0.7' },
    { url: '/plush-lab', changefreq: 'weekly', priority: '0.7' },
    { url: '/k9000', changefreq: 'weekly', priority: '0.8' },
    { url: '/groomers', changefreq: 'weekly', priority: '0.7' },
    { url: '/booking', changefreq: 'weekly', priority: '0.8' },
    { url: '/signin', changefreq: 'monthly', priority: '0.5' },
    { url: '/signup', changefreq: 'monthly', priority: '0.5' },
    { url: '/privacy', changefreq: 'monthly', priority: '0.4' },
    { url: '/terms', changefreq: 'monthly', priority: '0.4' },
    { url: '/accessibility', changefreq: 'monthly', priority: '0.4' },
  ];

  // Pull active stations from DB so each station gets its own indexable URL
  const stations = await fetchActiveStationSlugs();

  const staticEntries = staticPages
    .map(p => buildUrlEntry(baseUrl, p.url, p.changefreq, p.priority))
    .join('\n');

  const stationEntries = stations
    .map(s => buildUrlEntry(baseUrl, `/stations/${s.slug}`, 'weekly', '0.7'))
    .join('\n');

  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xhtml="http://www.w3.org/1999/xhtml">
${staticEntries}
${stationEntries}
</urlset>`;

  res.set({
    'Content-Type': 'application/xml',
    // Cache for 1 hour — fresh enough for crawlers, avoids DB hit per bot request
    'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400',
  });
  res.send(sitemap);

  logger.info('Sitemap served', {
    staticPages: staticPages.length,
    stationPages: stations.length,
    userAgent: req.headers['user-agent'],
  });
});

/**
 * GET /robots.txt - Tell search engines what to crawl
 */
router.get('/robots.txt', (req, res) => {
  const baseUrl = process.env.BASE_URL || 'https://petwash.co.il';
  
  const robots = `# ⁦Pet Wash™⁩ - Robots.txt
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

/**
 * GET /.well-known/security.txt - Security vulnerability disclosure endpoint
 * RFC 9116 compliant security.txt file for responsible disclosure
 */
router.get('/.well-known/security.txt', (req, res) => {
  const baseUrl = process.env.BASE_URL || 'https://www.petwash.co.il';
  
  const securityTxt = `Contact: mailto:security@petwash.co.il
Expires: 2026-12-31T23:59:59.000Z
Preferred-Languages: en, he
Canonical: ${baseUrl}/.well-known/security.txt
Policy: ${baseUrl}/security-policy
Hiring: ${baseUrl}/careers

# ⁦Pet Wash™⁩ Security Team
# We appreciate responsible disclosure of security vulnerabilities
# Response time: Within 48 hours
`;

  res.header('Content-Type', 'text/plain; charset=utf-8');
  res.send(securityTxt);
  
  logger.info('security.txt served', { userAgent: req.headers['user-agent'] });
});

export default router;
