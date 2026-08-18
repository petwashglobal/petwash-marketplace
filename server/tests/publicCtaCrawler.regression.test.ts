/**
 * PR-PUBLIC-CTA-CRAWLER — fire-order item 55.
 *
 * The actual crawler is tests/e2e/public-cta-crawler.spec.ts — a
 * Playwright suite that visits each canonical public route and asserts
 * HTTP 200, non-empty title, no visible "JavaScript Required" fallback,
 * no stale "Premium Organic Pet Care" branding, and non-empty #root.
 *
 * That suite needs a live app instance to run. This regression test is
 * lightweight companion that:
 *   - proves the spec file exists
 *   - pins the fire-order named routes into PUBLIC_ROUTES so a future
 *     author cannot silently remove one
 *   - pins the "JavaScript Required" + "Premium Organic Pet Care"
 *     forbidden-content guards
 */

import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

const ROOT = resolve(__dirname, '..', '..');
const SPEC = 'tests/e2e/public-cta-crawler.spec.ts';

describe('PR-PUBLIC-CTA-CRAWLER', () => {
  it('A1. Playwright spec exists', () => {
    expect(existsSync(resolve(ROOT, SPEC))).toBe(true);
  });

  const src = readFileSync(resolve(ROOT, SPEC), 'utf8');

  it('A2. PUBLIC_ROUTES covers every route the fire order explicitly named', () => {
    // Extract every `path: '...'` from PUBLIC_ROUTES.
    const paths = Array.from(src.matchAll(/path:\s*['"]([^'"]+)['"]/g)).map(m => m[1]);
    const covered = new Set(paths);
    const NAMED = [
      '/', '/loyalty', '/egift', '/locations', '/signup',
      '/careers', '/privacy', '/terms', '/walk-my-pet/explore',
      '/paw-finder', '/academy', '/become-provider', '/contact',
    ];
    for (const p of NAMED) {
      expect(covered.has(p), `fire-order named route missing: ${p}`).toBe(true);
    }
  });

  it('A3. crawler guards against the "JavaScript Required" visible fallback', () => {
    expect(src.includes("'JavaScript Required'") || src.includes('"JavaScript Required"')).toBe(true);
  });

  it('A4. crawler guards against stale "Premium Organic Pet Care" branding', () => {
    expect(src.includes('Premium Organic Pet Care')).toBe(true);
  });

  it('A5. crawler asserts #root has content (not a blank white screen)', () => {
    expect(/#root\s*>\s*\*/.test(src)).toBe(true);
    expect(/is\s*empty\s*—\s*blank\s*white\s*screen/i.test(src)).toBe(true);
  });

  it('A6. crawler never submits forms / never mutates', () => {
    // Safety pin: no .click(...submit), no page.fill(), no POST — this
    // is a GET sweep. Any addition of mutation would be a red flag.
    expect(/page\.fill\(/.test(src)).toBe(false);
    expect(/\.evaluate\([\s\S]*fetch\([^)]*method[^)]*POST/i.test(src)).toBe(false);
  });
});
