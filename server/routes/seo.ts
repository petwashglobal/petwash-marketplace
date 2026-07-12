import { Router } from 'express';
import { db } from '../db';
import { petWashStations } from '@shared/schema-enterprise';
import { ne } from 'drizzle-orm';
import { logger } from '../lib/logger';

const router = Router();

const IOS_PROVIDER_BUNDLE_ID = 'il.co.petwash.provider';
const IOS_CUSTOMER_BUNDLE_ID = 'com.petwash.il';

function appleTeamIdentifier(): string {
  return (
    process.env.APPLE_TEAM_IDENTIFIER ||
    process.env.APPLE_TEAM_ID ||
    process.env.APPLE_WALLET_TEAM_ID ||
    ''
  ).trim();
}

function buildAppleAppSiteAssociation(teamId: string) {
  return {
    applinks: {
      apps: [],
      details: [
        {
          appID: `${teamId}.${IOS_PROVIDER_BUNDLE_ID}`,
          paths: [
            '/provider',
            '/provider/*',
            '/provider-dashboard',
            '/provider-dashboard/*',
          ],
        },
        {
          appID: `${teamId}.${IOS_CUSTOMER_BUNDLE_ID}`,
          paths: [
            '/',
            '/booking',
            '/booking/*',
            '/marketplace/*',
            '/my-bookings',
            '/my-bookings/*',
            '/my-wallet',
            '/my-wallet/*',
            '/prestige-pass',
            '/wallet',
            '/locations',
            '/locations/*',
            '/packages',
            '/packages/*',
            '/vouchers',
            '/vouchers/*',
            '/shop',
            '/shop/*',
          ],
        },
      ],
    },
    webcredentials: {
      apps: [
        `${teamId}.${IOS_PROVIDER_BUNDLE_ID}`,
        `${teamId}.${IOS_CUSTOMER_BUNDLE_ID}`,
      ],
    },
  };
}

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

/**
 * Fetch station slugs for the sitemap from the SAME table + filter the public
 * station API uses (pet_wash_stations, non-decommissioned) so every sitemap URL
 * resolves. The URL slug IS the stationCode: /stations/:slug → the API
 * uppercases it and looks up by station_code, and StationPage's canonical is
 * `/stations/${stationCode.toLowerCase()}`. So we emit the lowercased
 * stationCode as the slug — sitemap URL === page canonical, no 404s, no
 * self-canonical mismatch. Read-only; never throws — returns [] on any error.
 */
async function fetchActiveStationSlugs(): Promise<{ slug: string; name: string }[]> {
  try {
    const rows = await db
      .select({
        stationCode: petWashStations.stationCode,
        name: petWashStations.stationName,
      })
      .from(petWashStations)
      .where(ne(petWashStations.operationalStatus, 'decommissioned'))
      .limit(500);
    return rows
      .filter((r) => !!r.stationCode)
      .map((r) => ({ slug: r.stationCode.toLowerCase(), name: r.name }));
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
    { url: '/prestige-pass', changefreq: 'weekly', priority: '0.8' },
    { url: '/academy', changefreq: 'weekly', priority: '0.7' },
    { url: '/buy-gift-card', changefreq: 'weekly', priority: '0.7' },
    { url: '/trust', changefreq: 'monthly', priority: '0.7' },
    { url: '/trust-safety', changefreq: 'monthly', priority: '0.6' },
    { url: '/shop', changefreq: 'weekly', priority: '0.6' },
    { url: '/careers', changefreq: 'monthly', priority: '0.5' },
    { url: '/privacy', changefreq: 'monthly', priority: '0.4' },
    { url: '/terms', changefreq: 'monthly', priority: '0.4' },
    { url: '/accessibility', changefreq: 'monthly', priority: '0.4' },
    { url: '/accessibility-statement', changefreq: 'monthly', priority: '0.3' },
  ];

  // /stations/:slug is live (App.tsx) and StationPage renders truthful live
  // per-station data, so re-enable station URLs. fetchActiveStationSlugs emits
  // the lowercased stationCode as the slug, matching the page canonical exactly.
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
 * GET /.well-known/apple-app-site-association
 * GET /apple-app-site-association
 *
 * Enables Universal Links for the approved Provider and Customer iOS apps.
 * Apple requires JSON without a .json extension and follows either location.
 */
router.get(['/.well-known/apple-app-site-association', '/apple-app-site-association'], (req, res) => {
  const teamId = appleTeamIdentifier();

  if (!teamId) {
    logger.error('[SEO] Cannot serve AASA: Apple Team ID env is missing');
    return res.status(503).json({
      applinks: { apps: [], details: [] },
      error: 'APPLE_TEAM_IDENTIFIER or APPLE_WALLET_TEAM_ID not configured',
    });
  }

  res.set({
    'Content-Type': 'application/json',
    'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400',
  });
  res.send(JSON.stringify(buildAppleAppSiteAssociation(teamId)));

  logger.info('Apple App Site Association served', {
    userAgent: req.headers['user-agent'],
  });
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
