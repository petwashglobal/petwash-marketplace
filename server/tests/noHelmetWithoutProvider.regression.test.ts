import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'fs';
import { join, resolve } from 'path';

/**
 * 2026-09-17 monitoring alert (critical): /marketplace/search crashed on every
 * visit — "Cannot read properties of undefined (reading 'add')" in
 * HelmetDispatcher.init. BookingSearchPage and ServiceLandingPage rendered
 * react-helmet-async's <Helmet>, but the app never mounts a <HelmetProvider>,
 * so the dispatcher's context was undefined. Head tags go through useSEO().
 */
const ROOT = resolve(__dirname, '..', '..', 'client', 'src');

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === '__tests__') continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(tsx?|jsx?)$/.test(name) && !/\.test\./.test(name)) out.push(p);
  }
  return out;
}

describe('react-helmet-async is only usable under a HelmetProvider', () => {
  const files = walk(ROOT);
  const code = (p: string) => readFileSync(p, 'utf8').replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '');
  const importers = files.filter((p) => /from\s+['"]react-helmet-async['"]/.test(code(p)));
  const providerMounted = files.some((p) => /<HelmetProvider[\s>]/.test(code(p)));

  it('no page imports react-helmet-async while no HelmetProvider is mounted', () => {
    if (!providerMounted) expect(importers.map((p) => p.slice(ROOT.length + 1))).toEqual([]);
  });

  it('the two pages that crashed set their head tags through useSEO', () => {
    for (const page of ['pages/BookingSearchPage.tsx', 'pages/ServiceLandingPage.tsx']) {
      const src = code(join(ROOT, page));
      expect(src).toContain("import { useSEO } from '@/lib/seo';");
      expect(src).toMatch(/useSEO\(\{/);
      expect(src).not.toContain('<Helmet');
    }
  });

  it('ServiceLandingPage calls useSEO before its 404 early return (rules of hooks)', () => {
    const src = code(join(ROOT, 'pages/ServiceLandingPage.tsx'));
    expect(src.indexOf('useSEO({')).toBeGreaterThan(0);
    expect(src.indexOf('useSEO({')).toBeLessThan(src.indexOf('if (!svc) {'));
  });
});
