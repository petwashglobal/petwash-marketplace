/**
 * Issue #153 PR-H — provider self-exclusion in runProviderSearch.
 *
 * Forensic audit (PR #202) finding F-06 + CEO-flagged "next door matched
 * me to me" bug:
 *   server/services/providerSearchService.ts:runProviderSearch(filters,
 *   callerUserId) accepted callerUserId but never filtered the caller's
 *   own provider record out of the results. A provider who searched the
 *   marketplace could see themselves as a candidate to book.
 *
 * Resolution — push the exclusion to the SQL WHERE clause in every
 * fetch path so the caller is never sent to themselves over the wire,
 * and the total/result count is truthful.
 *
 * Locked invariants:
 *
 *   A. The `ne` operator is imported from drizzle-orm.
 *   B. Each of the 3 fetch functions accepts `callerUserId?: string`.
 *   C. Each fetch function's WHERE includes
 *        `callerUserId ? ne(providers.userId, callerUserId) : undefined`
 *      — exclusion is conditional (no callerUserId ⇒ no behaviour change).
 *   D. fetchMarketplaceProviders plumbs callerUserId to every fetch call
 *      site (5 invocations total: 1 walker + 2 sitter calls + 2 by-platform).
 *   E. runProviderSearch passes callerUserId to fetchMarketplaceProviders.
 *   F. PR-E availability-flag-truth helpers are unchanged (scope guard).
 *   G. No money-flow keyword introduced. No schema / dependency / auth
 *      change. PR-J Nayax verifier and PR-W4 idempotency unaffected.
 *   H. PR-H traceability marker present.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const ROOT = resolve(__dirname, '..', '..');
const src = readFileSync(
  resolve(ROOT, 'server/services/providerSearchService.ts'),
  'utf8',
);

const codeOnly = src
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/^\s*\/\/.*$/gm, '');

// ── A. ne import ─────────────────────────────────────────────────────────

describe('PR-H — drizzle-orm ne operator imported', () => {
  it('1. providerSearchService imports `ne` from drizzle-orm', () => {
    expect(src).toMatch(
      /import\s*\{[^}]*\bne\b[^}]*\}\s*from\s*['"]drizzle-orm['"]/,
    );
  });
});

// ── B. Each fetch accepts callerUserId ───────────────────────────────────

describe('PR-H — fetch functions accept callerUserId', () => {
  it('2. fetchDogWalkers signature includes callerUserId?: string', () => {
    expect(src).toMatch(
      /async\s+function\s+fetchDogWalkers\s*\([\s\S]{0,400}callerUserId\?\s*:\s*string\s*,?\s*\)/,
    );
  });

  it('3. fetchSitters signature includes callerUserId?: string', () => {
    expect(src).toMatch(
      /async\s+function\s+fetchSitters\s*\([\s\S]{0,400}callerUserId\?\s*:\s*string\s*,?\s*\)/,
    );
  });

  it('4. fetchByPlatform signature includes callerUserId?: string', () => {
    expect(src).toMatch(
      /async\s+function\s+fetchByPlatform\s*\([\s\S]{0,400}callerUserId\?\s*:\s*string\s*,?\s*\)/,
    );
  });

  it('5. fetchMarketplaceProviders signature includes callerUserId?: string', () => {
    expect(src).toMatch(
      /async\s+function\s+fetchMarketplaceProviders\s*\([\s\S]{0,400}callerUserId\?\s*:\s*string\s*,?\s*\)/,
    );
  });
});

// ── C. Each fetch's WHERE adds the conditional ne exclusion ──────────────

describe('PR-H — WHERE clauses add ne(providers.userId, callerUserId)', () => {
  it('6. exclusion expression appears at least 3 times (one per fetch function)', () => {
    const pattern = /callerUserId\s*\?\s*ne\(\s*providers\.userId\s*,\s*callerUserId\s*\)\s*:\s*undefined/g;
    const matches = codeOnly.match(pattern) || [];
    expect(matches.length).toBeGreaterThanOrEqual(3);
  });

  it('7. each of the 3 fetch functions contains the exclusion expression in its body', () => {
    const fns = ['fetchDogWalkers', 'fetchSitters', 'fetchByPlatform'];
    for (const fn of fns) {
      const startIdx = src.indexOf(`async function ${fn}`);
      expect(startIdx).toBeGreaterThan(0);
      // Each function body is at most a few thousand chars; pin within 5000.
      const body = src.slice(startIdx, startIdx + 5000);
      expect(body).toMatch(
        /callerUserId\s*\?\s*ne\(\s*providers\.userId\s*,\s*callerUserId\s*\)\s*:\s*undefined/,
      );
    }
  });
});

// ── D. fetchMarketplaceProviders plumbs callerUserId everywhere ─────────

describe('PR-H — fetchMarketplaceProviders plumbs callerUserId to every call', () => {
  it('8. fetchMarketplaceProviders body forwards callerUserId to all 5 fetch invocations', () => {
    const startIdx = src.indexOf('async function fetchMarketplaceProviders');
    expect(startIdx).toBeGreaterThan(0);
    const body = src.slice(startIdx, startIdx + 4000);
    // Walker single-vertical
    expect(body).toMatch(/fetchDogWalkers\(\s*filters\s*,\s*callerUserId\s*\)/);
    // Sitter single-verticals (pet_sitting + daycare)
    const sitterMatches = body.match(/fetchSitters\([^)]*,\s*filters\s*,\s*callerUserId\s*\)/g) || [];
    expect(sitterMatches.length).toBeGreaterThanOrEqual(2);
    // by-platform single-verticals (groomers, pet_trek)
    const byPlatformMatches = body.match(/fetchByPlatform\([^)]*,\s*filters\s*,\s*callerUserId\s*\)/g) || [];
    expect(byPlatformMatches.length).toBeGreaterThanOrEqual(2);
  });
});

// ── E. runProviderSearch forwards callerUserId to fetchMarketplaceProviders

describe('PR-H — runProviderSearch forwards callerUserId', () => {
  it('9. runProviderSearch calls fetchMarketplaceProviders(filters, callerUserId)', () => {
    expect(src).toMatch(
      /fetchMarketplaceProviders\(\s*filters\s*,\s*callerUserId\s*\)/,
    );
  });

  it('10. runProviderSearch signature still accepts callerUserId?: string (preserved)', () => {
    expect(src).toMatch(
      /export\s+async\s+function\s+runProviderSearch\s*\([\s\S]{0,400}callerUserId\?\s*:\s*string/,
    );
  });
});

// ── F. PR-E availability-flag-truth helpers preserved (scope guard) ─────

describe('PR-H — PR-E availability helpers are unchanged (scope guard)', () => {
  it('11. parseRequestedRange + getConflictedProviderIds still present', () => {
    expect(src).toMatch(/function\s+parseRequestedRange\s*\(/);
    expect(src).toMatch(/function\s+getConflictedProviderIds\s*\(/);
  });

  it('12. BOOKING_BLOCKING_STATUSES constant unchanged (PR-E pin)', () => {
    expect(src).toMatch(/BOOKING_BLOCKING_STATUSES/);
    expect(src).toMatch(/['"]draft['"]/);
    expect(src).toMatch(/['"]pending_payment['"]/);
    expect(src).toMatch(/['"]pending_provider['"]/);
    expect(src).toMatch(/['"]confirmed['"]/);
    expect(src).toMatch(/['"]in_progress['"]/);
  });
});

// ── G. Scope guards: no money / schema / dependency drift ────────────────

describe('PR-H — scope guards (defence-in-depth)', () => {
  it('13. no money-flow keyword introduced anywhere new in this file', () => {
    expect(codeOnly).not.toMatch(
      /(payout|refund|wallet|charge|authorize|capture|invoice|receipt|nayax|tranzila|stripe|sumit)\s*\(/i,
    );
  });

  it('14. no pgTable / new schema export in this file', () => {
    expect(src).not.toMatch(/pgTable\s*\(/);
    expect(src).not.toMatch(/export\s+const\s+\w+\s*=\s*pgTable/);
  });
});

// ── H. Traceability ──────────────────────────────────────────────────────

describe('PR-H — traceability marker', () => {
  it('15. PR-H marker appears at least 3 times (one per fetch function comment + runProviderSearch)', () => {
    const matches = src.match(/PR-H/g) || [];
    expect(matches.length).toBeGreaterThanOrEqual(4);
  });
});
