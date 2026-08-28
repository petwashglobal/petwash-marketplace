/**
 * Escrow-reversal refund fan-out — source-pin regression on
 * server/services/fiscalPassport/lineage.ts.
 *
 * The bug this closes: ProviderPayoutService.ts:703 writes a refund on
 * an escrow cancel as
 *
 *   sourceType: 'escrow',
 *   sourceId:   String(payoutId),
 *   idempotencyKey: `refund:escrow:${payoutId}`
 *
 * — NEVER as ('booking', bookingId). Until this fan-out landed,
 * composeRefundLineage looked up refund_transactions solely by the
 * correlationId-derived pair (sourceType, sourceId) — so a sitter or
 * academy passport with a real escrow-reversal refund found NOTHING
 * and silently omitted the customer's returned money from the §36
 * REFUND lineage on both /my-transactions and /admin/fiscal-transactions.
 *
 * Discipline pins:
 *
 *   • For a booking-family correlation, composeRefundLineage MUST also
 *     probe ('escrow', <payoutId>) with the payout ids that funded the
 *     booking. Dropping the fan-out silently reintroduces the gap.
 *
 *   • The reverse-index helper reads super_app_payouts by booking_id —
 *     the only place ProviderPayoutService stores the booking↔payout
 *     link. A refactor pointing at pw_provider_payouts (the Unified
 *     Payments table) would miss every legacy row.
 *
 *   • The two SELECTs must both filter status IN ('succeeded',
 *     'approved', 'executing') — a pending obligation isn't money-moved
 *     yet per §85.
 *
 *   • Dedupe by refund_id keeps the render honest if a payout+booking
 *     pair ever surfaced the same row on both branches.
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

const SRC = fs.readFileSync(
  path.resolve(__dirname, '..', 'services', 'fiscalPassport', 'lineage.ts'),
  'utf8',
);

describe('escrow-reversal fan-out on booking-family correlations', () => {
  it('sitter/walk/academy correlations fan out to lookupPayoutIdsForBooking', () => {
    // The exact wire — the correlation kind is checked against the
    // ESCROW_FANOUT_KINDS set → payoutId probe → OR clause for
    // ('escrow', payoutIds). A refactor that unbraids this loop
    // silently drops the escrow branch.
    expect(SRC).toMatch(/const ESCROW_FANOUT_KINDS = new Set\(\[\s*'sitter',\s*'walk',\s*'academy'\s*\]\)/);
    expect(SRC).toMatch(/if\s*\(ESCROW_FANOUT_KINDS\.has\(rawKind\)\)[\s\S]*?lookupPayoutIdsForBooking\(sourceId\)/);
    expect(SRC).toMatch(/orClauses\.push\(\{\s*sourceType:\s*'escrow',\s*sourceIds:\s*payoutIds\s*\}\)/);
  });

  it('lookupPayoutIdsForBooking reads super_app_payouts.booking_id (the writer path)', () => {
    // Never pw_provider_payouts — that's the Unified Payments write path,
    // NOT what ProviderPayoutService writes today. Pinning the table
    // stops a well-intentioned rewrite from silently missing legacy
    // rows.
    expect(SRC).toMatch(/async function lookupPayoutIdsForBooking\(bookingId: string\)/);
    expect(SRC).toMatch(/FROM super_app_payouts WHERE booking_id = \$1/);
    expect(SRC).not.toMatch(/FROM pw_provider_payouts/);
  });

  it('both refund SELECTs filter money-moved statuses only', () => {
    // A pending obligation is NOT money-moved. §85 discipline: the
    // customer surface never shows a refund the bank hasn't confirmed.
    // Both queries must apply the filter (the escrow branch was the
    // exact place the gap existed).
    const selectCount = (SRC.match(/status\s+IN\s*\(\s*'succeeded',\s*'approved',\s*'executing'\s*\)/g) ?? []).length;
    expect(selectCount).toBeGreaterThanOrEqual(1);
    // The two queries share the same body — a single template with the
    // OR-clause array feeding it. Ensure the shared body carries the filter.
    expect(SRC).toMatch(/FROM refund_transactions[\s\S]*?WHERE source_type = \$1 AND source_id = ANY\(\$2::text\[\]\)[\s\S]*?status IN \('succeeded', 'approved', 'executing'\)/);
  });

  it('deduplicates by refund_id before rendering', () => {
    // If a payout+booking pair ever surfaced the same refund row on
    // both branches (belt-and-braces), the customer must not see it
    // twice.
    expect(SRC).toMatch(/const seen = new Set<string>\(\)/);
    expect(SRC).toMatch(/if \(seen\.has\(k\)\) continue/);
    // Deduped rows are re-sorted by created_at ASC so the customer sees
    // events in the order they actually happened.
    expect(SRC).toMatch(/dedupedRows\.sort/);
  });

  it("preserves fresh-env safety — 42P01 on the payoutId lookup returns []", () => {
    // A fresh env where super_app_payouts doesn't exist must NOT 500
    // the passport read; the strict ('booking', bookingId) branch
    // still renders honestly.
    expect(SRC).toMatch(/if \(err\?\.code === '42P01'\) return \[\]/);
  });

  it('correlationKindToSourceType covers every provider-booking flow', () => {
    // All three provider-booking flows (sitter, walk, academy) create a
    // super_app_payouts row keyed by booking_id via EnhancedBookingService.
    // If any of them stops mapping here, refunds tied to that flow
    // silently drop off the passport. Walk was the exact hole this
    // commit closed — it wasn't in the map at all, so its refunds
    // returned an empty lineage regardless of the escrow branch.
    expect(SRC).toMatch(/case 'sitter':\s*return 'booking'/);
    expect(SRC).toMatch(/case 'walk':\s*return 'walk'/);
    expect(SRC).toMatch(/case 'academy':\s*return 'academy'/);
  });
});
