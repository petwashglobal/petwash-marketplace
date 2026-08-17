/**
 * Regression pin — walk-my-pet /provider-respond concurrent Accept
 * previously created duplicate Firestore escrow docs (SELECT-then-
 * escrow-then-UPDATE with no lock). Lane B (2026-08-17) does an
 * atomic conditional UPDATE (WHERE status='pending_provider') BEFORE
 * the escrow call — the losing request returns 409 and does not
 * invoke the escrow rail.
 *
 * The same file has a legacy /walks/:bookingId/confirm route that got
 * the same treatment.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const src = readFileSync(
  join(__dirname, '..', '..', 'server', 'routes', 'walk-my-pet.ts'),
  'utf8',
);

describe('walk-my-pet provider-respond race guard', () => {
  it('imports the booking mutation lock helper (for observability + future callers)', () => {
    expect(src).toMatch(/from\s*['"][^'"]*bookingMutationLock['"]/);
  });

  it('performs an atomic status claim BEFORE walkEliteBookingEngine.confirmBooking (executable call site, not comment)', () => {
    // Anchor on real call sites, not comment mentions.
    const claimAt = src.indexOf(".set({ status: 'confirmed'");
    const confirmAt = src.indexOf('await walkEliteBookingEngine.confirmBooking(');
    expect(claimAt).toBeGreaterThan(-1);
    expect(confirmAt).toBeGreaterThan(-1);
    expect(claimAt).toBeLessThan(confirmAt);
  });

  it("scopes the conditional UPDATE to WHERE status='pending_provider'", () => {
    expect(src).toMatch(/eq\(walkBookings\.status,\s*['"]pending_provider['"]\)/);
  });

  it('returns 409 to the losing accept request', () => {
    // Two concurrent Accepts: first claims, second sees 0 rows updated,
    // returns 409 without invoking any downstream side effect.
    expect(src).toMatch(/provider-respond raced[\s\S]{0,300}?res\.status\(409\)/);
  });
});

describe('walk-my-pet legacy /walks/:bookingId/confirm race guard', () => {
  it("uses a conditional UPDATE keyed on status='pending' with 409 on race", () => {
    expect(src).toMatch(/eq\(walkBookings\.status,\s*['"]pending['"]\)[\s\S]{0,600}?res\.status\(409\)/);
  });
});
