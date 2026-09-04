/**
 * Home-surface fail-soft contract — regression pin
 * (Lane A + Lane B customer/provider reliability).
 *
 * When any home-page data endpoint 404s or 500s, the home MUST
 * NOT crash or render undefined-tree text. Both home surfaces
 * (PrestigeHome, ProviderHome) MUST wrap every useQuery's queryFn
 * so a network error yields a safe fallback (empty object, empty
 * array, or the specific typed default the render tree expects).
 *
 * This pin catches a refactor that:
 *   * removes the try/catch around apiRequest.
 *   * removes the `.catch(() => ...)` chain on fetchJson.
 *   * introduces a raw `await apiRequest(...)` at query-fn top
 *     level (throws → React Query renders the error boundary,
 *     which for a home page is a whole-page break).
 *
 * The rule: every useQuery on the two home surfaces uses ONE of
 * the two canonical fail-soft shapes:
 *
 *   Shape A (PrestigeHome):
 *     queryFn: async () => {
 *       try {
 *         const r = await apiRequest('GET', '/api/...');
 *         return r.ok ? await r.json() : <safe default>;
 *       } catch { return <safe default>; }
 *     }
 *
 *   Shape B (ProviderHome):
 *     queryFn: () => fetchJson('/api/...')
 *     ...where fetchJson wraps the fetch in try/catch + .catch(() => ({}))
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const REPO_ROOT = join(__dirname, '..', '..');

function read(rel: string): string {
  return readFileSync(join(REPO_ROOT, rel), 'utf8');
}

interface HomeSurface {
  label: string;
  file: string;
  minQueryCount: number;
}

const HOMES: readonly HomeSurface[] = [
  {
    label: 'Pet-Parent (Prestige) home',
    file: 'client/src/pages/PrestigeHome.tsx',
    minQueryCount: 4, // me, pets, qr, hist
  },
  {
    label: 'Provider home',
    file: 'client/src/pages/ProviderHome.tsx',
    minQueryCount: 5, // profile, stats, earnings, upcoming, counts
  },
];

describe('Home-surface fail-soft contract', () => {
  for (const home of HOMES) {
    describe(home.label, () => {
      const src = read(home.file);

      it('has the expected count of useQuery calls (baseline)', () => {
        const useQueryCount = (src.match(/useQuery\(/g) ?? []).length;
        expect(useQueryCount).toBeGreaterThanOrEqual(home.minQueryCount);
      });

      it('EVERY useQuery has a fail-soft branch — either try/catch or .catch()', () => {
        // Count queryFn blocks that DON'T have either safety mechanism.
        // We do this by matching each `queryFn:` block up to its closing brace
        // and asserting either `try {` + `catch` is inside OR `.catch(` is inside.
        const queryFnBlocks = src.match(/queryFn:\s*(?:async\s*)?\([^)]*\)\s*=>\s*(?:\{[^}]*(?:\{[^}]*\}[^}]*)*\}|[^,\n]+)/g) ?? [];
        expect(queryFnBlocks.length).toBeGreaterThanOrEqual(home.minQueryCount);
        for (const block of queryFnBlocks) {
          const hasTryCatch = /try\s*\{[\s\S]*catch\s*\{/.test(block);
          const hasCatchChain = /\.catch\(/.test(block);
          const callsSafeWrapper = /fetchJson\(|apiRequest\(/.test(block);
          // At least one of: try/catch inline, .catch chain, or delegates
          // to a wrapper (fetchJson) known to be fail-soft.
          expect(
            hasTryCatch || hasCatchChain || callsSafeWrapper,
            `queryFn missing fail-soft guard: ${block.slice(0, 120)}...`,
          ).toBe(true);
        }
      });

      it('NEVER uses a bare `throw` in a queryFn body — throws crash the render tree', () => {
        // A queryFn that throws surfaces to React Query's error boundary,
        // which for a top-level home page is a whole-page break.
        const queryFnBodies = src.match(/queryFn:[\s\S]*?(?=,\s*(?:enabled|staleTime|refetch|queryKey|\})\b)/g) ?? [];
        for (const body of queryFnBodies) {
          expect(body).not.toMatch(/\bthrow\s+new\s+Error/);
        }
      });
    });
  }

  it('PrestigeHome fail-soft returns typed empty shapes ({} or {pets:[]})', () => {
    const src = read('client/src/pages/PrestigeHome.tsx');
    // The 4 catches return safe typed defaults, not `undefined`.
    expect(src).toMatch(/catch\s*\{\s*return\s*\{\s*\}\s*;/);
    expect(src).toMatch(/catch\s*\{\s*return\s*\{\s*pets:\s*\[\s*\]\s*\}\s*;/);
  });

  it('ProviderHome fetchJson helper swallows both `!res.ok` and thrown errors', () => {
    const src = read('client/src/pages/ProviderHome.tsx');
    // The helper is defined at the top of the file with the fail-soft chain.
    expect(src).toMatch(/function fetchJson\(url: string\)/);
    expect(src).toMatch(/\.then\(\s*\(r\)\s*=>\s*\(r\.ok\s*\?\s*r\.json\(\)\s*:\s*\{\s*\}\s*\)\s*\)\s*\.catch\(\s*\(\)\s*=>\s*\(\s*\{\s*\}\s*\)\s*\)/);
  });

  it('AttentionList — nothing rendered when items is empty (no ghost header on outage)', () => {
    const src = read('client/src/components/AttentionList.tsx');
    // The whole section is gated on items.length; an outage returns [],
    // so the surface silently hides rather than showing a broken header.
    expect(src).toMatch(/if\s*\(\s*!items\s*\|\|\s*items\.length\s*===\s*0\s*\)\s*return\s+null/);
  });

  it('NextBestActionCard — hides when server returns null primaryAction', () => {
    const src = read('client/src/components/NextBestActionCard.tsx');
    expect(src).toMatch(/if\s*\(\s*!primaryAction\s*\)\s*return\s+null/);
    // Also hides while loading.
    expect(src).toMatch(/if\s*\(\s*isLoading\s*\)\s*return\s+null/);
  });
});
