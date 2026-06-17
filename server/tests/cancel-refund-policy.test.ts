/**
 * cancel-refund-policy.test.ts
 *
 * Guards the cancellation-refund fix: the marketplace cancel path used to refund
 * 100% of escrow gross on EVERY cancel (cancel-to-avoid-fee leak), bypassing the
 * tiered BookingPolicyEngine. This pins the wiring so it can't silently regress.
 *
 * Source-introspection (repo's no-DB test style) + a pure check of the
 * percent→cents math the settlement uses.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const ROOT = resolve(__dirname, '..', '..');
const src = (rel: string) => readFileSync(resolve(ROOT, rel), 'utf8');

describe('Cancel refund — escrow settlement applies a policy percent', () => {
  const svc = src('server/services/BookingLifecycleService.ts');

  it('settleEscrowTerminal accepts a refundPercentOverride', () => {
    expect(svc).toMatch(/settleEscrowTerminal\([^)]*refundPercentOverride/s);
  });

  it('refund is computed from the percent, not hardcoded to full gross', () => {
    // The refundAmountCents written must derive from the percent (no longer a
    // bare escrow.grossAmountCents on the cancel path).
    expect(svc).toMatch(/grossAmountCents\s*\*\s*pct/);
    expect(svc).toMatch(/refundAmountCents:\s*refundCents/);
  });

  it('percent is clamped to [0,100] so it can never over-refund', () => {
    expect(svc).toMatch(/Math\.max\(0,\s*Math\.min\(100,\s*refundPercentOverride\)\)/);
  });

  it('omitted override defaults to a full (100%) refund — safe default', () => {
    expect(svc).toMatch(/refundPercentOverride == null \? 100/);
  });
});

describe('Cancel route — wires the policy engine correctly', () => {
  const route = src('server/routes/marketplace-bookings.ts');

  it('customer cancel runs through bookingPolicyEngine.calculateCancellation', () => {
    expect(route).toMatch(/derivedRole === 'customer'/);
    expect(route).toMatch(/calculateCancellation/);
  });

  it('the computed percent is passed to transitionStatus', () => {
    expect(route).toMatch(/refundPercentOverride/);
    expect(route).toMatch(/transitionStatus\([\s\S]*refundPercentOverride/);
  });

  it('provider/admin cancels leave override undefined (full refund — not their fault)', () => {
    // override is only set inside the customer branch.
    expect(route).toMatch(/let refundPercentOverride: number \| undefined/);
  });
});

describe('Default cancellation policy is seeded', () => {
  it('migration seeds an "all" policy with tiered rules', () => {
    const mig = src('migrations/0052_seed_booking_cancellation_policy.sql');
    expect(mig).toMatch(/booking_policies/);
    expect(mig).toMatch(/'all'/);
    expect(mig).toMatch(/24_hours_before/);
    expect(mig).toMatch(/ON CONFLICT \(policy_id\) DO NOTHING/);
  });
});

describe('percent→cents math (the settlement formula)', () => {
  const refundCents = (grossCents: number, pct?: number) => {
    const p = pct == null ? 100 : Math.max(0, Math.min(100, pct));
    return Math.round((grossCents * p) / 100);
  };
  it('100% (or omitted) refunds full gross', () => {
    expect(refundCents(12000)).toBe(12000);
    expect(refundCents(12000, 100)).toBe(12000);
  });
  it('50% refunds half', () => expect(refundCents(12000, 50)).toBe(6000));
  it('0% refunds nothing', () => expect(refundCents(12000, 0)).toBe(0));
  it('out-of-range clamps (never over-refunds)', () => {
    expect(refundCents(12000, 150)).toBe(12000);
    expect(refundCents(12000, -10)).toBe(0);
  });
});
