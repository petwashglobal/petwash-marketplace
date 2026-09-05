/**
 * Issue #153 priority 4 (OPT-A) — customer marketplace-booking visibility regression pin.
 *
 * Bridge fix: the customer /bookings page used to read only
 * /api/booking-requests, leaving marketplace bookings (PG `bookings` table)
 * invisible to customers. We added a second `useQuery` to
 * /api/marketplace-bookings/my-bookings that the page merges client-side.
 *
 * Hard constraints this pin enforces (per the OPT-A spec):
 *   - second query is wired and customer-scoped (no user-id URL param)
 *   - safe-field allowlist: provider payout, platform fee, payment intent,
 *     payout status, platform data are NEVER referenced
 *   - partial-failure resilience: marketplaceQuery uses retry:false so a
 *     failed marketplace query does NOT block legacy booking_requests render
 *   - cancel mutation is gated to kind !== 'marketplace' (cancel still hits
 *     the booking_requests endpoint and would 404 for marketplace rows)
 *   - rows tagged with kind: 'marketplace' get a small visible badge
 *
 * Out of scope (NOT exercised by this test, NOT in this PR):
 *   - Firestore K9000 station washes (separate source)
 *   - /api/customer/all-bookings backend aggregator
 *   - escrow / payout normalization across systems
 */

import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

const SRC = fs.readFileSync(
  path.resolve(__dirname, 'CustomerBookings.tsx'),
  'utf8',
);

describe('CustomerBookings — Issue #153 P4 OPT-A regression pin', () => {
  it('queries the existing legacy booking_requests endpoint', () => {
    expect(SRC).toMatch(/queryKey:\s*\[\s*['"]\/api\/booking-requests['"]\s*\]/);
  });

  it('queries the marketplace customer-scoped endpoint as a second source', () => {
    expect(SRC).toMatch(
      /queryKey:\s*\[\s*['"]\/api\/marketplace-bookings\/my-bookings['"]\s*\]/,
    );
  });

  it('marketplace query disables retry so a failure does not block legacy render', () => {
    // The marketplace useQuery block must contain retry: false so the legacy
    // booking_requests view continues to render on partial failure.
    const mpBlock = SRC.match(
      /['"]\/api\/marketplace-bookings\/my-bookings['"][\s\S]{0,400}/,
    )?.[0] ?? '';
    expect(mpBlock).toMatch(/retry:\s*false/);
  });

  it('does NOT spread or copy unsafe internal fields from marketplace rows', () => {
    // The mapper (marketplaceFromRow) must not reference these fields. They
    // are payout / platform internals that the customer should never see
    // through the bridge.
    const codeOnly = SRC.replace(/\/\/[^\n]*\n/g, '\n').replace(/\/\*[\s\S]*?\*\//g, '');
    for (const unsafe of [
      'providerPayout',
      'platformFee',
      'paymentIntentId',
      'payoutStatus',
      'platformData',
      'taxAmount',
    ]) {
      expect(codeOnly).not.toMatch(new RegExp(`\\b${unsafe}\\b`));
    }
  });

  it('mapper sets kind: "marketplace" on every projected row', () => {
    expect(SRC).toMatch(/marketplaceFromRow[\s\S]*?kind:\s*['"]marketplace['"]/);
  });

  it('renders a "Marketplace" badge on rows tagged kind === "marketplace"', () => {
    expect(SRC).toMatch(/booking\.kind\s*===\s*['"]marketplace['"]/);
    expect(SRC).toMatch(/data-testid="badge-marketplace-source"/);
  });

  it('cancel button is gated to kind !== "marketplace"', () => {
    // Implementation is now an explicit allowlist (CANCELLABLE_KINDS) rather
    // than a `!== 'marketplace'` denylist — functionally equivalent (fails
    // closed for any future kind too) but this pin was string-matching the
    // old denylist form and going stale as a false negative. Assert the
    // real invariant: 'marketplace' is absent from the allowlist that gates
    // canCancel.
    expect(SRC).toMatch(/const CANCELLABLE_KINDS = new Set\(\[[^\]]*\]\)/);
    const setMatch = SRC.match(/const CANCELLABLE_KINDS = new Set\((\[[^\]]*\])\)/);
    expect(setMatch).not.toBeNull();
    expect(setMatch![1]).not.toMatch(/marketplace/);
    expect(SRC).toMatch(/canCancel\s*=\s*CANCELLABLE_STATUSES\.has\(booking\.status\)[\s\S]{0,80}CANCELLABLE_KINDS\.has\(booking\.kind/);
  });

  it('Booking interface declares the kind discriminator (request | marketplace)', () => {
    expect(SRC).toMatch(/kind\?:\s*['"]request['"]\s*\|\s*['"]marketplace['"]/);
  });

  it('combines + sorts by createdAt desc so marketplace and legacy rows interleave correctly', () => {
    // Existence of a sort-by-createdAt in the merge step.
    expect(SRC).toMatch(/createdAt[\s\S]{0,200}getTime/);
  });

  it('does NOT include any Firestore K9000 client SDK reads (out of scope for OPT-A)', () => {
    const codeOnly = SRC.replace(/\/\/[^\n]*\n/g, '\n').replace(/\/\*[\s\S]*?\*\//g, '');
    expect(codeOnly).not.toMatch(/firestore/i);
    expect(codeOnly).not.toMatch(/firebase\/firestore/);
  });
});
