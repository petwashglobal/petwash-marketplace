import { describe, it, expect, vi, afterEach, beforeAll } from 'vitest';
import { readFileSync, mkdtempSync } from 'fs';
import { tmpdir } from 'os';
import { join, resolve } from 'path';
import { pathToFileURL } from 'url';
import { build, buildSync } from 'esbuild';
import {
  TIER_CONFIGS,
  calculateTotalDiscount,
  type LoyaltyTier,
} from '@shared/schema-loyalty';

/**
 * Hamburger-menu truth audit 2026-09-13 — pages that said things that are not true.
 *
 *  1. /loyalty/refer shared the bare homepage (no code → attributable to nobody)
 *     and advertised a 200/750/1,500/3,500-point referral ladder that exists nowhere.
 *  2. /loyalty showed a signed-in NON-member a Member-tier dashboard ("Guest"),
 *     a points estimate of washes × 500 and a "total saved" estimate.
 *  3. /legal/loyalty-terms listed Bronze…Royal at 1,000/3,000/…/35,000 points and
 *     "5% to 25% off" — none of it matches shared/schema-loyalty.ts.
 *  4. Three legal pages printed today's date as "Last updated".
 *  5. The "eGift and refund policy" menu item opened a page outside the legal registry.
 *  6. Signed-in eGift buyers could type a custom amount that then answered "coming soon".
 *  7. /legal/terms, /legal/privacy, /legal/egift-policy, /legal/loyalty-terms,
 *     /legal/cookies had NO canonical after hydration: they never called useSEO,
 *     and #2459 removed the homepage canonical from the SPA shell.
 */
const ROOT = resolve(__dirname, '..', '..');
const R = (p: string) => readFileSync(join(ROOT, p), 'utf8');
/** Source with comments removed — the fixes explain in comments what they replaced. */
const CODE = (p: string) =>
  R(p).replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

// The client tsconfig sets jsx:"preserve", so vitest cannot import a page .tsx
// directly. Bundle the REAL page with esbuild (the same transform the build
// uses) and render it server-side — a behaviour test, not a source grep.
type TermsBundle = {
  render: () => string;
  loyaltyTermsTiers: () => Array<{ id: string; name: string; points: string; discount: number }>;
  LOYALTY_TERMS_LAST_UPDATED: string;
};
let terms: TermsBundle;
beforeAll(async () => {
  const out = join(mkdtempSync(join(tmpdir(), 'menu-truth-')), 'terms.mjs');
  buildSync({
    stdin: {
      contents: [
        "import { createElement } from 'react';",
        "import { renderToStaticMarkup } from 'react-dom/server';",
        "import LoyaltyTerms, { loyaltyTermsTiers, LOYALTY_TERMS_LAST_UPDATED } from './client/src/pages/legal/LoyaltyTerms';",
        "export const render = () => renderToStaticMarkup(createElement(LoyaltyTerms));",
        'export { loyaltyTermsTiers, LOYALTY_TERMS_LAST_UPDATED };',
      ].join('\n'),
      resolveDir: ROOT,
      loader: 'tsx',
    },
    bundle: true,
    format: 'esm',
    platform: 'node',
    jsx: 'automatic',
    alias: { '@shared': join(ROOT, 'shared'), '@': join(ROOT, 'client/src') },
    outfile: out,
    logLevel: 'silent',
  });
  terms = (await import(pathToFileURL(out).href)) as TermsBundle;
}, 60_000);

afterEach(() => {
  vi.useRealTimers();
});

describe('3. /legal/loyalty-terms renders the ladder FROM schema-loyalty.ts', () => {
  it('every tier name, threshold and discount comes from TIER_CONFIGS / calculateTotalDiscount', () => {
    const rows = terms.loyaltyTermsTiers();
    expect(rows.map((r) => r.id)).toEqual(TIER_CONFIGS.map((c) => c.id));
    rows.forEach((row, i) => {
      const cfg = TIER_CONFIGS[i];
      expect(row.name).toBe(cfg.name);
      expect(row.points).toBe(cfg.threshold.toLocaleString('en-US'));
      expect(row.discount).toBe(calculateTotalDiscount(cfg.id as LoyaltyTier, 'none', false));
    });
  });

  it('the rendered page shows the real names and discount range, never the invented ones', () => {
    const html = terms.render();
    for (const cfg of TIER_CONFIGS) {
      expect(html).toContain(cfg.name);
      expect(html).toContain(`${cfg.threshold.toLocaleString('en-US')} points`);
    }
    const discounts = TIER_CONFIGS.map((c) => calculateTotalDiscount(c.id as LoyaltyTier, 'none', false));
    expect(html).toContain(`Discounted wash rates (${Math.min(...discounts)}% to ${Math.max(...discounts)}% off)`);
    expect(html).not.toContain('25% off');
    expect(html).not.toMatch(/>Bronze</);
    expect(html).not.toMatch(/>Royal</);
    expect(html).not.toContain('35,000 points');
  });

  it('the "Last updated" date does not move with the clock', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2031-01-01T00:00:00Z'));
    const html = terms.render();
    expect(html).toContain(`Last updated: ${terms.LOYALTY_TERMS_LAST_UPDATED}`);
    expect(html).not.toContain('2031');
  });
});

describe('4. legal "Last updated" dates are fixed constants', () => {
  it.each([
    'client/src/pages/legal/EGiftPolicy.tsx',
    'client/src/pages/legal/LoyaltyTerms.tsx',
    'client/src/pages/legal/Cookies.tsx',
  ])('%s', (file) => {
    const src = CODE(file);
    expect(src).not.toMatch(/new Date\(\)/);
    expect(src).toMatch(/Last updated: \{[A-Z_]+_LAST_UPDATED\}/);
    expect(src).toMatch(/export const [A-Z_]+_LAST_UPDATED = "\d{4}-\d{2}-\d{2}";/);
  });
});

describe('1. /loyalty/refer shares the member link and promises no invented ladder', () => {
  const src = CODE('client/src/pages/LoyaltyRefer.tsx');

  it('no 200 / 750 / 1,500 / 3,500-point reward ladder', () => {
    expect(src).not.toMatch(/reward:\s*'(200|750|1,500|3,500)'/);
    expect(src).not.toMatch(/Free (Basic|Premium) Wash/);
    expect(src).not.toMatch(/Tier Upgrade/);
    expect(src).not.toMatch(/Both of you receive/);
  });

  it('shares the server-built referral link, never the bare homepage', () => {
    expect(src).not.toMatch(/siteUrl/);
    expect(src).toMatch(/linkData\?\.referralLink/);
    expect(src).not.toMatch(/encodeURIComponent\('https:\/\/petwash\.co\.il'\)/);
    // share buttons are inert until the link exists
    expect(src).toMatch(/href=\{referralLink \? button\.href : undefined\}/);
    // the server really returns that field
    expect(R('server/routes/referral.ts')).toMatch(/referralLink: `\$\{baseUrl\}\/ref\?code=\$\{referralCode\}`/);
  });

  it('reads the app language store, not the legacy petwash_lang key', () => {
    expect(src).not.toMatch(/petwash_lang/);
    expect(src).toMatch(/useLanguage\(\)/);
  });
});

describe('2. /loyalty — non-members get the join landing, members get no estimates', () => {
  const src = CODE('client/src/pages/Loyalty.tsx');

  it('a signed-in account without an active enrolment renders the public join landing', () => {
    expect(src).toMatch(/const prestigeEnrolled = whoami\?\.prestigeStatus === 'active';/);
    const gate = src.slice(src.indexOf('if (!firebaseUser || !prestigeEnrolled)'));
    expect(src).toContain('if (!firebaseUser || !prestigeEnrolled)');
    expect(gate.slice(0, 300)).toContain('<PublicPrivilegeLanding');
    expect(src).not.toMatch(/\|\| 'Guest'/);
  });

  it('no washes × 500 points estimate and no "total saved" estimate', () => {
    expect(src).not.toMatch(/POINTS_PER_WASH/);
    expect(src).not.toMatch(/washes \* 500/);
    expect(src).not.toMatch(/calculatePointsValue/);
    expect(src).not.toMatch(/totalSaved/);
  });

  it('discounts come from schema-loyalty; no 10/15/20% discount perk keys', () => {
    expect(src).toMatch(/import \{ calculateTotalDiscount \} from '@shared\/schema-loyalty'/);
    expect(src).not.toMatch(/perk_(10|15|20)_discount/);
    expect(src).not.toMatch(/\.discount\}%/);
  });

  it('reads the app language store, not the legacy petwash_lang key', () => {
    expect(src).not.toMatch(/petwash_lang/);
    expect(src).toMatch(/useLanguage\(\)/);
  });
});

describe('5. the eGift terms menu item opens the registry document', () => {
  it('points at /legal/wallet-egift-terms, which App.tsx routes to WalletEGiftTerms', () => {
    const header = R('client/src/components/PetWashHeader.tsx');
    expect(header).toMatch(/\{ id: "egift-policy", labelKey: "egift-policy\.label", href: "\/legal\/wallet-egift-terms" \}/);
    expect(header).not.toMatch(/en: "eGift and refund policy"/);
    const app = R('client/src/App.tsx');
    expect(app).toMatch(/<Route path="\/legal\/wallet-egift-terms">\s*\{\(\) => <LegalWalletEGiftTerms \/>\}/);
    expect(R('shared/lib/legalDocumentRegistry.ts')).toContain("clientPath: 'client/src/pages/legal/WalletEGiftTerms.tsx'");
  });
});

describe('6. signed-in eGift buyers are not offered a custom amount they cannot pay', () => {
  it('the custom-amount control renders only for guests', () => {
    const src = CODE('client/src/pages/EGift.tsx');
    const gate = src.indexOf('{!user && (');
    const button = src.indexOf('data-testid="button-custom-amount"');
    expect(gate).toBeGreaterThan(-1);
    expect(button).toBeGreaterThan(gate);
    // nothing closes the guard between the gate and the input
    const between = src.slice(gate, src.indexOf('data-testid="input-custom-amount"'));
    expect(between).not.toMatch(/\n {10}\)\}\n/);
  });
});

describe('7. legal menu pages call useSEO with their own copy and a route-derived canonical', () => {
  // Render each REAL page (as App.tsx routes it) with useSEO swapped for a recorder,
  // so the test sees exactly what the page hands to useSEO on render.
  type Recorded = { title: string; description: string; canonical?: string };
  const PAGES: Array<[route: string, file: string]> = [
    ['/legal/terms', 'client/src/pages/legal/CustomerTerms'],
    ['/legal/privacy', 'client/src/pages/legal/PrivacyPolicy'],
    ['/legal/egift-policy', 'client/src/pages/legal/EGiftPolicy'],
    ['/legal/loyalty-terms', 'client/src/pages/legal/LoyaltyTerms'],
    ['/legal/cookies', 'client/src/pages/legal/Cookies'],
    ['/legal/wallet-egift-terms', 'client/src/pages/legal/WalletEGiftTerms'],
  ];
  let renderPage: (file: string, route: string) => Recorded[];

  beforeAll(async () => {
    const out = join(mkdtempSync(join(tmpdir(), 'menu-truth-seo-')), 'pages.mjs');
    const stubs: Record<string, string> = {
      '@/lib/seo': `export { pageSEO, defaultSEO } from ${JSON.stringify(join(ROOT, 'client/src/lib/seo.ts'))};
        export function useSEO(config) { (globalThis.__seoCalls ||= []).push(config); }`,
      '@/lib/languageStore': `export function useLanguage() { return { language: 'en', setLanguage() {}, t: (k) => k, dir: 'ltr' }; }`,
      '@/auth/AuthProvider': `export function useFirebaseAuth() { return { user: null, loading: false }; }`,
      '@/lib/queryClient': `export async function apiRequest() { throw new Error('no network in test'); }`,
    };
    await build({
      stdin: {
        contents: [
          "import { createElement } from 'react';",
          "import { renderToStaticMarkup } from 'react-dom/server';",
          ...PAGES.map(([, f], i) => `import P${i} from './${f}';`),
          `const MAP = { ${PAGES.map(([, f], i) => `${JSON.stringify(f)}: P${i}`).join(', ')} };`,
          'export function renderPage(file, route) { globalThis.location ||= { pathname: route, search: \'\', hash: \'\' }; globalThis.location.pathname = route; globalThis.__seoCalls = []; renderToStaticMarkup(createElement(MAP[file])); return globalThis.__seoCalls; }',
        ].join('\n'),
        resolveDir: ROOT,
        loader: 'tsx',
      },
      bundle: true,
      format: 'esm',
      platform: 'node',
      jsx: 'automatic',
      alias: { '@shared': join(ROOT, 'shared'), '@': join(ROOT, 'client/src') },
      plugins: [{
        name: 'seo-recorder',
        setup(build) {
          build.onResolve({ filter: /^@\/(lib\/seo|lib\/languageStore|auth\/AuthProvider|lib\/queryClient)$/ }, (args) => ({ path: args.path, namespace: 'stub' }));
          build.onLoad({ filter: /.*/, namespace: 'stub' }, (args) => ({ contents: stubs[args.path], loader: 'js', resolveDir: ROOT }));
        },
      }],
      outfile: out,
      logLevel: 'silent',
    });
    ({ renderPage } = (await import(pathToFileURL(out).href)) as { renderPage: typeof renderPage });
  }, 60_000);

  it.each(PAGES)('%s', (route, file) => {
    // App.tsx really routes this path to this page
    const app = R('client/src/App.tsx');
    const base = file.split('/').pop()!;
    const lazyName = app.match(new RegExp(`const (\\w+) = lazy\\(\\(\\) => import\\("@/pages/legal/${base}"\\)\\)`))?.[1];
    expect(lazyName).toBeTruthy();
    expect(app).toMatch(new RegExp(`<Route path="${route.replace(/\//g, '\\/')}">\\s*\\{\\(\\) => (<Layout>)?<${lazyName} />`));

    const calls = renderPage(file, route);
    expect(calls.length).toBe(1);
    const [cfg] = calls;
    expect(cfg.title.length).toBeGreaterThan(0);
    expect(cfg.description.length).toBeGreaterThan(0);
    expect(cfg.title).toMatch(/PetWash/);
    // no hard-coded canonical → useSEO derives it from the route itself
    expect(cfg.canonical).toBeUndefined();
  });

  it('useSEO still derives the canonical from the pathname when none is passed', () => {
    const seo = R('client/src/lib/seo.ts');
    expect(seo).toContain("seoConfig.canonical ?? `https://petwash.co.il${path === '/' ? '/' : path.replace(/\\/+$/, '')}`");
    expect(seo).toMatch(/canonical\.setAttribute\('href', canonicalHref\)/);
  });

  it('LegalIndex keeps its own useSEO and does not get a second one from LegalPage', () => {
    const idx = CODE('client/src/pages/legal/LegalIndex.tsx');
    expect(idx).toContain('useSEO(pageSEO.legalIndex)');
    expect(idx).toMatch(/<LegalPage\s+skipSeo/);
  });
});
