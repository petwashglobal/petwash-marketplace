/**
 * PR-CUSTOMER-BOOKINGS-REVIEW-CTA — regression pin for the "Leave a review /
 * Confirm & rate" CTA on the customer's My Bookings list.
 *
 * HISTORY: #1916 fixed the CTA to gate on `provider_marked_complete` (the
 * actionable pre-confirm window BookingConfirmation.tsx's rating form is
 * gated on) as well as `completed`, with a context-aware label and a stable
 * data-testid. The very next commit on main, #1882 ("canonical booking-
 * status labels + 3 consumer migrations"), touched this same file for an
 * unrelated reason (migrating the status-badge text to a shared helper) and
 * its diff silently reverted #1916's canReview/handleReview/button changes
 * back to the pre-fix `status === 'completed'`-only gate — with no test
 * failure at the time because this test file wasn't run as part of that
 * PR's own verification. It then sat RED on main.
 *
 * Effect on real users: the moment a provider marked a booking done
 * (status -> provider_marked_complete), the customer's My Bookings list
 * showed NO way to confirm or rate it — canReview was false until the
 * status somehow became 'completed', which normally only happens AFTER the
 * customer confirms. Dead end.
 *
 * This rewrite restores the working gate and re-pins it. Two details from
 * the original #1916 fix are NOT restored because they were already
 * inert/vestigial even when first written (verified against the server):
 *   - `!booking.ownerRating`: GET /api/booking-requests has never returned
 *     an `ownerRating` field (checked server/routes/booking-requests.ts —
 *     the response is an explicit field allowlist that omits it), so this
 *     clause has always evaluated to `!undefined` = true. Already-rated
 *     bookings are excluded a different way: they move to status
 *     'reviewed', which canReview never matches.
 *   - `?review=1` deep-link: BookingConfirmation.tsx has no handler for a
 *     `review` query param today (grepped — no `useSearch`/
 *     `location.search`/scrollIntoView tied to it). Adding the param back
 *     would be a no-op; the rating form still renders on that page because
 *     its own gate (`canConfirm = isOwner && status === 'provider_marked_complete'`)
 *     is independent and intact.
 *
 * Also pinned: the #2051 marketplace-routing fix (handleReview sends
 * `kind === 'marketplace'` bookings to /marketplace/review/:id instead of
 * the booking_requests confirmation page) must not regress.
 */

import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

const SRC = fs.readFileSync(
  path.resolve(__dirname, 'CustomerBookings.tsx'),
  'utf8',
);

describe('CustomerBookings — Review/Confirm-and-rate CTA pin', () => {
  it('canReview includes provider_marked_complete (the actionable window)', () => {
    expect(SRC).toMatch(
      /const canReview\s*=\s*booking\.status\s*===\s*['"]provider_marked_complete['"]\s*\|\|\s*booking\.status\s*===\s*['"]completed['"]/,
    );
  });

  it('never re-introduces the dead status === "completed"-only gate', () => {
    expect(SRC).not.toMatch(/const\s+canReview\s*=\s*booking\.status\s*===\s*['"]completed['"]\s*;/);
  });

  it('CTA has a stable data-testid per booking id', () => {
    expect(SRC).toMatch(/data-testid=\{`booking-review-cta-\$\{booking\.requestId\}`\}/);
  });

  it('label is context-aware — Confirm & rate for provider_marked_complete', () => {
    expect(SRC).toMatch(
      /booking\.status\s*===\s*['"]provider_marked_complete['"][\s\S]{0,180}Confirm & rate/,
    );
    expect(SRC).toContain('אשר/י ודרג/י'); // HE version present too
  });

  it('post-confirmation fallback keeps the original Leave-a-review copy', () => {
    expect(SRC).toContain('Leave a review');
    expect(SRC).toContain('כתוב ביקורת');
  });

  it('does not regress the #2051 marketplace-rail review routing', () => {
    expect(SRC).toMatch(
      /if \(booking\.kind === 'marketplace'\) \{\s*navigate\(`\/marketplace\/review\/\$\{booking\.requestId\}`\);/,
    );
  });
});
