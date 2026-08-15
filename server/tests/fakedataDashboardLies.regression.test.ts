/**
 * PR-FAKEDATA-DASHBOARD-LIES — customer Dashboard tiles show TRUTH.
 *
 * Audit Agent D (2026-08-15) FAKEDATA finding — the customer
 * Dashboard's three prestige tiles were displaying invented values:
 *
 *   Saved Carers   — hardcoded literal `0` (JSX text node)
 *   Saved Cards    — hardcoded literal `0` (JSX text node)
 *   Lifetime Value — `formatCurrency(loyaltyPoints * 10)` — an
 *                    invented formula with NOTHING to do with what
 *                    the customer actually spent (loyalty points and
 *                    total-spent are two different ledgers).
 *
 * CEO called these "lies" — a luxury card that lies is worse than a
 * plain one that says nothing. Fix:
 *   server/routes/user-activity.ts — /summary now returns
 *     savedProvidersCount + savedCardsCount + totalSpentCents from the
 *     REAL tables (saved_providers rows / active payment_tokens rows /
 *     users.total_spent).
 *   client/src/pages/Dashboard.tsx — the three tiles read those fields
 *     via activityData, tagged with data-testid so this test can pin
 *     them and no future refactor can silently re-introduce the lies.
 *
 * Sections:
 *   A. Server — summary endpoint queries the real tables and returns
 *      the three new fields
 *   B. Client — Dashboard tiles read the real values (no hardcoded `0`,
 *      no `loyaltyPoints * 10`)
 */

import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

const ROOT = resolve(__dirname, '..', '..');
const SERVER = 'server/routes/user-activity.ts';
const CLIENT = 'client/src/pages/Dashboard.tsx';

function read(rel: string): string {
  return readFileSync(resolve(ROOT, rel), 'utf8');
}
function codeOnly(src: string): string {
  let out = src;
  out = out.replace(/\/\*[\s\S]*?\*\//g, '');
  out = out.replace(/(^|[^:])\/\/.*$/gm, '$1');
  return out;
}

// ─────────────────────────────────────────────────────────────────────────
// A. Server — /api/user/activity/summary carries real counts
// ─────────────────────────────────────────────────────────────────────────
describe('PR-FAKEDATA-DASHBOARD-LIES — A. summary endpoint', () => {
  const src = read(SERVER);
  const code = codeOnly(src);

  it('A1. file exists', () => {
    expect(existsSync(resolve(ROOT, SERVER))).toBe(true);
  });

  it('A2. imports savedProviders + paymentTokens + users from shared schema', () => {
    expect(/from\s+['"]@shared\/schema['"]/.test(code)).toBe(true);
    expect(/\bsavedProviders\b/.test(code)).toBe(true);
    expect(/\bpaymentTokens\b/.test(code)).toBe(true);
    expect(/\busers\b/.test(code)).toBe(true);
  });

  it('A3. computes savedProvidersCount from saved_providers table', () => {
    // count(*)::int + .from(savedProviders) + scoped to uid.
    expect(/const\s*\[\s*row\s*\]\s*=\s*await\s+db[\s\S]*?\.from\(\s*savedProviders\s*\)/.test(code)).toBe(true);
    expect(/savedProvidersCount\s*=\s*row\?\.count\s*\?\?\s*0/.test(code)).toBe(true);
  });

  it('A4. computes savedCardsCount from payment_tokens WHERE status=active', () => {
    expect(/\.from\(\s*paymentTokens\s*\)/.test(code)).toBe(true);
    // status filter must be present — an unfiltered count would include
    // revoked/expired/failed cards and lie again.
    expect(/eq\(\s*paymentTokens\.status\s*,\s*['"]active['"]\s*\)/.test(code)).toBe(true);
    expect(/savedCardsCount\s*=\s*row\?\.count\s*\?\?\s*0/.test(code)).toBe(true);
  });

  it('A5. computes totalSpentCents from users.total_spent (ILS → agorot)', () => {
    expect(/users\.totalSpent/.test(code)).toBe(true);
    // ILS decimal * 100 = agorot for the shared formatCurrency helper.
    expect(/Math\.round\(\s*ils\s*\*\s*100\s*\)/.test(code)).toBe(true);
  });

  it('A6. response payload includes all three new fields', () => {
    // Pinned in the res.json object literal.
    expect(/res\.json\(\s*\{[\s\S]*?savedProvidersCount[\s\S]*?savedCardsCount[\s\S]*?totalSpentCents[\s\S]*?\}\s*\)/.test(code)).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────
// B. Client — Dashboard tiles read the real values
// ─────────────────────────────────────────────────────────────────────────
describe('PR-FAKEDATA-DASHBOARD-LIES — B. Dashboard tiles', () => {
  const src = read(CLIENT);
  const code = codeOnly(src);

  it('B1. ActivitySummary interface carries the three new fields', () => {
    expect(/savedProvidersCount\?\s*:\s*number/.test(code)).toBe(true);
    expect(/savedCardsCount\?\s*:\s*number/.test(code)).toBe(true);
    expect(/totalSpentCents\?\s*:\s*number/.test(code)).toBe(true);
  });

  it('B2. derives tile values from activityData (not literals, not formulas)', () => {
    expect(/savedCarersCount\s*=\s*activityData\?\.savedProvidersCount\s*\?\?\s*0/.test(code)).toBe(true);
    expect(/savedCardsCount\s*=\s*activityData\?\.savedCardsCount\s*\?\?\s*0/.test(code)).toBe(true);
    expect(/lifetimeValueCents\s*=\s*activityData\?\.totalSpentCents\s*\?\?\s*0/.test(code)).toBe(true);
  });

  it('B3. tiles are tagged with data-testid so a future refactor cannot silently remove them', () => {
    expect(src).toContain('data-testid="tile-saved-carers"');
    expect(src).toContain('data-testid="tile-saved-cards"');
    expect(src).toContain('data-testid="tile-lifetime-value"');
  });

  it('B4. tile bodies render the derived counters (not JSX text `0`)', () => {
    // The tile lines: <p ... data-testid="tile-..."> {counter} </p>
    // Pin each testid to its counter reference; a regression that puts
    // `0` back in as a hardcoded JSX text node would fail this.
    const savedCarersLine = src.match(/data-testid="tile-saved-carers"[^>]*>\s*\{([^}]+)\}/);
    expect(savedCarersLine?.[1]?.trim()).toBe('savedCarersCount');

    const savedCardsLine = src.match(/data-testid="tile-saved-cards"[^>]*>\s*\{([^}]+)\}/);
    expect(savedCardsLine?.[1]?.trim()).toBe('savedCardsCount');
  });

  it('B5. Lifetime Value tile no longer uses the invented loyaltyPoints multiplier formula', () => {
    // The pre-fix formula was `formatCurrency(loyaltyPoints * 10)` —
    // if any code path (comments aside) reintroduces the pattern
    // `loyaltyPoints * <digit>`, this test catches it.
    expect(/loyaltyPoints\s*\*\s*\d+/.test(code)).toBe(false);
  });

  it('B6. Lifetime Value tile renders formatCurrency(lifetimeValueCents)', () => {
    expect(/formatCurrency\(\s*lifetimeValueCents\s*\)/.test(code)).toBe(true);
  });
});
