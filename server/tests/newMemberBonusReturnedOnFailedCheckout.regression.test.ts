/**
 * The one-time new-member 10% is not burned by a checkout that never paid
 * — regression pin (2026-09-13).
 *
 * Carried over from #2467's "Not in this PR (CEO decision)" list.
 *
 * POST /api/checkout sets users.hasUsedNewMemberDiscount = true while it is
 * still BUILDING the Nayax session — before the customer has paid anything.
 * That write is deliberate (it stops the same one-time bonus being spent by
 * two concurrent sessions), but nothing ever gave the bonus back: an
 * abandoned, declined or expired checkout consumed the member's one-time 10%
 * permanently, and the member had no way to see it or get it back.
 *
 * The bonus is only really redeemed on payment.completed (that branch
 * re-asserts the flag). So the terminal-failure branch of the checkout
 * webhook now restores it.
 *
 * Source-level pins, matching the style of
 * nayax-checkout-webhook-failclosed.test.ts — these paths need live Nayax
 * events plus Firestore, so the pins assert the guard exists and stays
 * correctly scoped rather than re-simulating the webhook.
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

const WEBHOOKS = fs.readFileSync(
  path.resolve(__dirname, '..', 'routes', 'nayax-webhooks.ts'),
  'utf8',
);

/** The terminal-failure branch of the checkout webhook. */
function failureBranch(): string {
  const start = WEBHOOKS.indexOf(
    "} else if (payload.event === 'payment.failed' || payload.event === 'payment.expired' || payload.event === 'payment.cancelled') {",
  );
  expect(start).toBeGreaterThan(-1);
  const end = WEBHOOKS.indexOf('unhandled_event', start);
  expect(end).toBeGreaterThan(start);
  return WEBHOOKS.slice(start, end);
}

describe('new-member bonus survives a checkout that never paid (2026-09-13)', () => {
  it('the failure branch clears hasUsedNewMemberDiscount', () => {
    expect(failureBranch()).toMatch(/hasUsedNewMemberDiscount:\s*false/);
  });

  it('it restores only when THIS session actually burned the bonus', () => {
    const branch = failureBranch();
    // Both conditions matter: a session that ran at the 5% regular-member rate
    // never set the flag and must not clear it.
    expect(branch).toMatch(/hasUsedNewMemberDiscount === true/);
    expect(branch).toMatch(/discountType === 'new_member_bonus'/);
  });

  it('it writes against the wash history row owner, not a client-supplied id', () => {
    expect(failureBranch()).toMatch(/historyRow\.userId/);
  });

  it('a restore failure cannot fail the webhook (Nayax still gets its 200)', () => {
    const branch = failureBranch();
    expect(branch).toMatch(/catch \(restoreErr/);
    expect(branch).toMatch(/Could not return new-member bonus/);
    expect(branch).toMatch(/received: true/);
  });

  it('payment.completed still re-asserts the flag (the bonus IS spent when paid)', () => {
    // Search forward from the redemption guard — an earlier webhook in this
    // file has its own payment.failed branch, so an unanchored indexOf for the
    // failure marker can land before this point and yield an empty slice.
    const start = WEBHOOKS.indexOf('if (isNewMemberDiscountApplied)');
    expect(start).toBeGreaterThan(-1);
    const end = WEBHOOKS.indexOf("} else if (payload.event === 'payment.failed'", start);
    expect(end).toBeGreaterThan(start);
    expect(WEBHOOKS.slice(start, end)).toMatch(/hasUsedNewMemberDiscount:\s*true/);
  });
});
