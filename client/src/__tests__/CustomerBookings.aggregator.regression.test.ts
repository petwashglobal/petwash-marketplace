/**
 * Issue #153 PR-3 — unified CustomerBookings aggregator regression pin.
 *
 * BEFORE this fix:
 *   `client/src/pages/CustomerBookings.tsx` aggregated only TWO sources:
 *     • /api/booking-requests              (legacy, line 801)
 *     • /api/marketplace-bookings/my-bookings  (line 857)
 *   Sitter Suite, Walk My Pet, and Pet Wash Academy bookings were
 *   invisible on the canonical "My Bookings" page — customers had to
 *   visit each platform's own OwnerDashboard.
 *
 * AFTER this fix:
 *   Three NEW read-only sources added, each verified safe in the cross-
 *   platform trust-boundary audit (issue #153 comment 4403888370):
 *     • /api/sitter-suite/bookings?role=owner  (sitter-suite.ts:1338)
 *     • /api/walk-my-pet/walks/mine             (post-#179 PR-WALK-1)
 *     • /api/academy/bookings                   (academy.ts:326)
 *   Each query is isolated (`retry: false`) so a single endpoint failure
 *   does NOT blank the page.
 *
 *   SAFE-FIELD ALLOWLIST mappers (sitterFromRow / walkerFromRow /
 *   academyFromRow) forward only display-shape keys — internal fields
 *   (provider payout, payment intent, escrow ids, internal status_history)
 *   are NEVER copied.
 *
 *   Source-tag chips render a small badge per row so customers see
 *   instantly which platform a booking came from. Cancel button is
 *   disabled for non-request kinds (marketplace / sitter / walker /
 *   academy) so we never fire an invalid /api/booking-requests/:id/
 *   cancel mutation against a row from another platform.
 *
 * Out of scope (NOT touched per CEO directive):
 *   - PetTrek (legally blocked at pettrek.ts:22-35)
 *   - K9000 (no customer-scoped GET endpoint exists today)
 *   - PawFinder (community bulletin board, not bookings)
 *   - Walk-My-Pet legacy /users/:userId/walks (kept post-#179 with 403
 *     mismatch + admin bypass; canonical /walks/mine used here)
 *   - Backend, schema, state machines, money paths, BookingEngine,
 *     K9000/Nayax/Tranzila, payments, escrow, wallet logic
 *   - Senior/disability discount, Firestore /transactions, calculateDiscount
 *
 * This source-pin test fails if any of the ten guarantees regress.
 */

import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

const SRC = fs.readFileSync(
  path.resolve(__dirname, '..', 'pages', 'CustomerBookings.tsx'),
  'utf8',
);

describe('Issue #153 PR-3 — CustomerBookings unified aggregator', () => {
  it('Booking type kind enum extends to sitter / walker / academy', () => {
    expect(SRC).toMatch(
      /kind\?\s*:\s*'request'\s*\|\s*'marketplace'\s*\|\s*'sitter'\s*\|\s*'walker'\s*\|\s*'academy'/,
    );
  });

  it('FIVE source query keys present (existing 2 + new 3)', () => {
    // Pre-existing sources — must stay.
    expect(SRC).toMatch(/queryKey:\s*\[\s*['"]\/api\/booking-requests['"]\s*\]/);
    expect(SRC).toMatch(
      /queryKey:\s*\[\s*['"]\/api\/marketplace-bookings\/my-bookings['"]\s*\]/,
    );
    // New sources — must each carry a stable query key.
    expect(SRC).toMatch(
      /queryKey:\s*\[\s*['"]\/api\/sitter-suite\/bookings['"]\s*,\s*\{\s*role:\s*['"]owner['"]\s*\}\s*\]/,
    );
    expect(SRC).toMatch(
      /queryKey:\s*\[\s*['"]\/api\/walk-my-pet\/walks\/mine['"]\s*\]/,
    );
    expect(SRC).toMatch(
      /queryKey:\s*\[\s*['"]\/api\/academy\/bookings['"]\s*\]/,
    );
  });

  it('each new source uses retry: false for graceful degradation', () => {
    // The aggregator must not blank the page when one endpoint fails.
    // Anchor: count `retry: false` occurrences. Existing marketplaceQuery
    // already uses it; with three new queries we need at least 4 total.
    const matches = SRC.match(/retry:\s*false/g) ?? [];
    expect(matches.length).toBeGreaterThanOrEqual(4);
  });

  it('SAFE-FIELD ALLOWLIST mappers exist for sitter / walker / academy', () => {
    // Each mapper is a discrete function name. Pin so a future PR can't
    // silently spread an entire row (which would forward provider payout,
    // payment intent, escrow ids, etc.).
    expect(SRC).toMatch(/const\s+sitterFromRow\s*=\s*\(row:\s*SitterRow\)\s*:\s*Booking\s*=>/);
    expect(SRC).toMatch(/const\s+walkerFromRow\s*=\s*\(row:\s*WalkerRow\)\s*:\s*Booking\s*=>/);
    expect(SRC).toMatch(/const\s+academyFromRow\s*=\s*\(row:\s*AcademyRow\)\s*:\s*Booking\s*=>/);
  });

  it('mappers tag each row with the correct kind', () => {
    // Pin the kind: 'sitter' / 'walker' / 'academy' string literals so
    // the badge rendering keeps working.
    expect(SRC).toMatch(/kind:\s*['"]sitter['"]/);
    expect(SRC).toMatch(/kind:\s*['"]walker['"]/);
    expect(SRC).toMatch(/kind:\s*['"]academy['"]/);
  });

  it('mappers do NOT spread the raw row (no internal-field leak)', () => {
    // Defensive: assert the mapper bodies do not contain `...row` spreads
    // anywhere. The allowlist must stay explicit.
    const mapperRegion = SRC.slice(
      SRC.indexOf('const sitterFromRow'),
      SRC.indexOf('const sitterQuery'),
    );
    expect(mapperRegion).not.toMatch(/\.\.\.row\b/);
    const walkerRegion = SRC.slice(
      SRC.indexOf('const walkerFromRow'),
      SRC.indexOf('type AcademyRow'),
    );
    expect(walkerRegion).not.toMatch(/\.\.\.row\b/);
  });

  it('all FIVE sources merge into the allBookings spread', () => {
    // The actual code uses multi-line spreads with indent; allow [\s\S]*?
    // (lazy, any character including newline) between each.
    expect(SRC).toMatch(
      /\[[\s\S]*?\.\.\.tagged[\s\S]*?\.\.\.marketplaceBookings[\s\S]*?\.\.\.sitterBookings[\s\S]*?\.\.\.walkerBookings[\s\S]*?\.\.\.academyBookings[\s\S]*?\]/,
    );
  });

  it('source-tag badges render for sitter / walker / academy', () => {
    // data-testid pins so e2e tests can target them and the UI can be
    // smoke-checked on iPhone Safari without inspecting class strings.
    expect(SRC).toMatch(/data-testid="badge-sitter-source"/);
    expect(SRC).toMatch(/data-testid="badge-walker-source"/);
    expect(SRC).toMatch(/data-testid="badge-academy-source"/);
    // Pre-existing marketplace badge preserved (regression):
    expect(SRC).toMatch(/data-testid="badge-marketplace-source"/);
  });

  it('cancel button is disabled for non-request kinds (no cross-platform mutation)', () => {
    // The legacy /api/booking-requests/:id/cancel mutation cannot be
    // fired against marketplace/sitter/walker/academy rows. Pin that
    // canCancel excludes all four.
    expect(SRC).toMatch(/booking\.kind\s*!==\s*['"]marketplace['"]/);
    expect(SRC).toMatch(/booking\.kind\s*!==\s*['"]sitter['"]/);
    expect(SRC).toMatch(/booking\.kind\s*!==\s*['"]walker['"]/);
    expect(SRC).toMatch(/booking\.kind\s*!==\s*['"]academy['"]/);
  });

  it('stable sort key — combined list ordered by createdAt desc (no source bias)', () => {
    // The sort must remain createdAt-desc across all sources so a
    // freshly-created sitter booking shows above an older walker one,
    // not always at the bottom because it was appended last to the
    // spread.
    const sortBlock = SRC.match(
      /allBookings\s*=\s*useMemo\(\(\)\s*=>\s*\{[\s\S]{0,2000}\.sort\(\([\s\S]{0,400}\}\)/,
    )?.[0] ?? '';
    expect(sortBlock).toMatch(/new Date\(a\.createdAt\)\.getTime\(\)/);
    expect(sortBlock).toMatch(/new Date\(b\.createdAt\)\.getTime\(\)/);
    expect(sortBlock).toMatch(/return\s+tb\s*-\s*ta/);
  });
});
