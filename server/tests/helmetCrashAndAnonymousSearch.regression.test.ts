import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync, readdirSync, statSync, mkdtempSync } from 'fs';
import { join, resolve } from 'path';
import { tmpdir } from 'os';
import { pathToFileURL } from 'url';
import { build } from 'esbuild';

/**
 * Live crawl 2026-09-17:
 *  - /marketplace/search and every /services/... landing page rendered the
 *    crash screen: they used react-helmet-async <Helmet>, but the app never
 *    mounts a HelmetProvider → "Cannot read properties of undefined (reading 'add')".
 *  - /marketplace showed "No providers found … Failed" for every signed-out
 *    visitor: POST /api/marketplace/search (read-only) was 403 EBADCSRFTOKEN,
 *    because Firebase Hosting strips the pw.csrf cookie.
 */
const ROOT = resolve(__dirname, '..', '..');
const R = (p: string) => readFileSync(join(ROOT, p), 'utf8');

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(join(ROOT, dir))) {
    const rel = `${dir}/${name}`;
    if (statSync(join(ROOT, rel)).isDirectory()) walk(rel, out);
    else if (/\.(tsx|ts)$/.test(name) && !/\.test\./.test(name)) out.push(rel);
  }
  return out;
}

describe('no page uses react-helmet-async without a HelmetProvider', () => {
  it('either nothing imports it, or a HelmetProvider is mounted', () => {
    const files = walk('client/src');
    const users = files.filter((f) => /from ['"]react-helmet-async['"]/.test(R(f)) && !/HelmetProvider/.test(R(f)));
    const hasProvider = files.some((f) => /<HelmetProvider/.test(R(f)));
    expect(hasProvider || users.length === 0, `Helmet used without provider in: ${users.join(', ')}`).toBe(true);
  });
});

describe('the two crashed pages now render', () => {
  let render: (name: string) => { html: string; seo: any[] };

  beforeAll(async () => {
    const out = join(mkdtempSync(join(tmpdir(), 'helmet-crash-')), 'pages.mjs');
    const stubs: Record<string, string> = {
      '@/lib/seo': `export function useSEO(config) { (globalThis.__seo ||= []).push(config); }`,
      '@/lib/languageStore': `export function useLanguage() { return { language: 'he', setLanguage() {}, t: (k) => k, dir: 'rtl' }; }`,
      '@/components/booking/BookingSearch': `export default function BookingSearch() { return 'SEARCH'; }`,
      '@/components/TrustBar': `export default function TrustBar() { return null; }`,
    };
    await build({
      stdin: {
        contents: [
          "import { createElement as h } from 'react';",
          "import { renderToStaticMarkup } from 'react-dom/server';",
          "import { Router, Route } from 'wouter';",
          "import Landing from './client/src/pages/ServiceLandingPage';",
          "import Search from './client/src/pages/BookingSearchPage';",
          'export function render(name) {',
          '  globalThis.__seo = [];',
          "  const el = name === 'landing'",
          "    ? h(Router, { ssrPath: '/services/pet-sitting/tel-aviv' }, h(Route, { path: '/services/:service/:city', component: Landing }))",
          '    : h(Search);',
          '  return { html: renderToStaticMarkup(el), seo: globalThis.__seo };',
          '}',
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
        name: 'stubs',
        setup(b) {
          b.onResolve({ filter: /^@\/(lib\/seo|lib\/languageStore|components\/booking\/BookingSearch|components\/TrustBar)$/ }, (a) => ({ path: a.path, namespace: 'stub' }));
          b.onLoad({ filter: /.*/, namespace: 'stub' }, (a) => ({ contents: stubs[a.path], loader: 'js', resolveDir: ROOT }));
        },
      }],
      outfile: out,
      logLevel: 'silent',
    });
    ({ render } = (await import(pathToFileURL(out).href)) as any);
  }, 60_000);

  it('/marketplace/search renders its search and sets its title', () => {
    const r = render('search');
    expect(r.html).toContain('SEARCH');
    expect(r.seo[0]?.title).toMatch(/PetWash/);
  });

  it('/services/pet-sitting/tel-aviv renders and self-canonicalises', () => {
    const r = render('landing');
    expect(r.html.length).toBeGreaterThan(200);
    expect(r.html).not.toContain('>404<');
    expect(r.seo[0]?.canonical).toBe('https://petwash.co.il/services/pet-sitting/tel-aviv');
    expect(r.seo[0]?.noindex).toBe(false);
  });
});

describe('signed-out visitors can search providers', () => {
  it('POST /api/marketplace/search is CSRF-exempt (read-only query)', () => {
    const idx = R('server/index.ts');
    const start = idx.indexOf('const AUTH_CSRF_EXEMPT = new Set([');
    const set = idx.slice(start, idx.indexOf(']);', start));
    expect(set).toContain("'/api/marketplace/search'");
  });

  it('the search handler writes nothing', () => {
    const m = R('server/routes/marketplace.ts');
    const handler = m.slice(m.indexOf("router.post('/search'"), m.indexOf('\n});\n', m.indexOf("router.post('/search'")));
    expect(handler.length).toBeGreaterThan(100);
    expect(handler).not.toMatch(/\.insert\(|\.update\(|\.delete\(|INSERT |UPDATE |DELETE /);
  });
});
