/**
 * Provider-earnings bucket safety under reversal states (CEO §25).
 *
 * §25 rule: "provider card says Paid ₪100 when ledger says reversed"
 * must never happen. The bucketFor() mapping in providerEarnings.ts
 * gates PAID on ce_payout_status='paid_out' explicitly and AVAILABLE
 * on ce_payout_status='released' — any other value falls through to
 * PENDING (still in escrow), which is honest but conservative.
 *
 * This test pins the DEFENCE-IN-DEPTH rule by reading the source:
 *   • PAID gate is a literal string match on 'paid_out' — no fuzzy
 *     regex, no truthy check that could match 'paid_out_reversed'
 *     later.
 *   • AVAILABLE gate is a literal string match on 'released'.
 *   • The fallthrough for any unknown / failed / refunded / reversed
 *     value returns PENDING, never PAID or AVAILABLE.
 *
 * Explicit-string-match discipline is the load-bearing part. A
 * refactor that swaps the equality checks for e.g. .startsWith('paid')
 * would flip 'paid_out_reversed' into PAID silently.
 *
 * Structural pin (reads providerEarnings.ts). A follow-up integration
 * test with a real contractor_earnings row + a refund event chain
 * would tighten this further; that requires shared DB fixtures.
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

const SRC = fs.readFileSync(
  path.resolve(__dirname, '..', 'services', 'providerEarnings.ts'),
  'utf8',
);

// Extract the bucketFor function body — every rule under review lives here.
function extractFn(name: string): string {
  const start = SRC.indexOf(`function ${name}`);
  if (start < 0) throw new Error(`${name} not found in providerEarnings.ts`);
  // Naive brace balance — good enough for the small local functions.
  let depth = 0;
  let i = SRC.indexOf('{', start);
  const bodyStart = i;
  for (; i < SRC.length; i++) {
    if (SRC[i] === '{') depth++;
    else if (SRC[i] === '}') {
      depth--;
      if (depth === 0) return SRC.slice(bodyStart, i + 1);
    }
  }
  throw new Error(`${name} body did not close`);
}

const bucketForBody = extractFn('bucketFor');

describe('providerEarnings bucketFor — reversal safety (§25)', () => {
  it('PAID gate is a literal equality on `paid_out` (no prefix / regex / truthy)', () => {
    // The whole point: `paid_out_reversed` must NEVER match PAID. A
    // literal `=== 'paid_out'` is the only shape this test accepts.
    expect(bucketForBody).toMatch(/effectivePayoutStatus\s*===\s*['"]paid_out['"]/);
    // Ban dangerous shapes that would let a reversal in.
    expect(bucketForBody).not.toMatch(/startsWith\(['"]paid/i);
    expect(bucketForBody).not.toMatch(/includes\(['"]paid/i);
    expect(bucketForBody).not.toMatch(/\/paid/i); // regex literal starting with 'paid'
  });

  it('AVAILABLE gate is a literal equality on `released`', () => {
    expect(bucketForBody).toMatch(/effectivePayoutStatus\s*===\s*['"]released['"]/);
    expect(bucketForBody).not.toMatch(/startsWith\(['"]released/i);
  });

  it('unknown / failed / refunded ce_payout_status falls through to PENDING (never PAID)', () => {
    // The function returns 'pending' as the last non-null bucket for a
    // done booking; there is no default that would return 'paid'.
    // Ban any `return 'paid'` outside the paid_out branch.
    const paidReturns = bucketForBody.match(/return\s+['"]paid['"]/g) ?? [];
    expect(paidReturns.length).toBe(1);
    // And that ONE return is on the branch that checks paid_out.
    expect(bucketForBody).toMatch(/effectivePayoutStatus\s*===\s*['"]paid_out['"]\)\s*return\s+['"]paid['"]/);
  });

  it('effectivePayoutStatus prefers contractor_earnings over the mirror (mirror never flips off pending)', () => {
    // The whole join exists because booking_requests.payout_status is
    // stuck at 'pending'. CE wins when both are present.
    expect(bucketForBody).toMatch(/const\s+effectivePayoutStatus\s*=\s*ceStatus\s*\?\?\s*mirrorStatus/);
  });

  it('DONE_STATUSES gate is applied BEFORE any paid/available check (no premature promotion)', () => {
    // A refactor that flipped the order could hand PAID to an
    // in-progress or accepted row that somehow had a stale
    // ce.payout_status='paid_out'. The DONE_STATUSES.includes check
    // must fire first.
    const doneIdx = bucketForBody.indexOf('DONE_STATUSES');
    const paidOutIdx = bucketForBody.indexOf("'paid_out'");
    expect(doneIdx).toBeGreaterThan(-1);
    expect(paidOutIdx).toBeGreaterThan(-1);
    expect(doneIdx).toBeLessThan(paidOutIdx);
  });
});
