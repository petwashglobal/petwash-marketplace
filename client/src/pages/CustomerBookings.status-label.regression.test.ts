/**
 * PR-CUSTOMER-BOOKINGS-STATUS-LABEL — regression pin for status-pill text on
 * CustomerBookings.tsx.
 *
 * HISTORY: this file originally pinned a page-local `STATUS_LABELS` map
 * (added #1919). That map was legitimately deleted on main by #1882
 * ("canonical booking-status labels + 3 consumer migrations"), which moved
 * every page onto ONE shared helper — @shared/lib/bookingStatusLabels — so
 * this test then asserted against code that no longer existed and was RED
 * on main. Rewritten to test the real, current behaviour instead of a
 * structure that was superseded by a better fix.
 *
 * Still-live gap found while restoring this pin: `pending_provider` (the
 * 2026-07-31 legacy sitter/walk create status — still written today by
 * server/routes/sitter-suite.ts and server/routes/walk-my-pet.ts) is NOT a
 * canonical BookingStatus, so bookingStatusLabel() fell through to its
 * raw-uppercase fallback and rendered "PENDING PROVIDER" on the status pill
 * instead of the familiar "Pending" every other pending-ish status shows.
 * Fixed by aliasing it to 'pending' at the CustomerBookings render site only
 * (matches the existing STATUS_TO_TAB / CANCELLABLE_STATUSES treatment of
 * the same legacy status as a 'pending' alias) — the canonical map itself is
 * intentionally NOT extended (see its own doc comment: "fix the writer, not
 * the map").
 */

import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';
import { bookingStatusLabel } from '../../../shared/lib/bookingStatusLabels';

const SRC = fs.readFileSync(
  path.resolve(__dirname, 'CustomerBookings.tsx'),
  'utf8',
);

describe('CustomerBookings — status label source', () => {
  it('reads labels from the canonical shared helper, not a page-local map', () => {
    expect(SRC).toMatch(/import\s*\{\s*bookingStatusLabel\s*\}\s*from\s*['"]@shared\/lib\/bookingStatusLabels['"]/);
    expect(SRC).not.toMatch(/^const STATUS_LABELS/m);
  });

  it('provider_marked_complete has a friendly HE + EN label (canonical helper)', () => {
    expect(bookingStatusLabel('provider_marked_complete', 'en')).toBe('Awaiting your confirmation');
    expect(bookingStatusLabel('provider_marked_complete', 'he')).toBe('ממתין לאישורך');
  });

  it('meet_greet_requested has a label (canonical helper)', () => {
    expect(bookingStatusLabel('meet_greet_requested', 'en')).toBe('Meet & Greet requested');
    expect(bookingStatusLabel('meet_greet_requested', 'he')).toBeTruthy();
  });

  it('every canonical status the helper knows about resolves to a non-raw label', () => {
    for (const s of [
      'pending', 'accepted', 'declined', 'meet_greet_requested', 'meet_greet_scheduled',
      'meet_greet_completed', 'payment_pending', 'confirmed', 'in_progress',
      'provider_marked_complete', 'completed', 'reviewed', 'cancelled', 'disputed',
    ]) {
      const label = bookingStatusLabel(s, 'en');
      expect(label).not.toBe(s.replace(/_/g, ' ').toUpperCase());
    }
  });
});

describe('CustomerBookings — legacy pending_provider alias (was: raw "PENDING PROVIDER")', () => {
  it('the canonical helper alone does NOT have a friendly label for it (documents the gap)', () => {
    // pending_provider is intentionally not a canonical BookingStatus — this
    // assertion exists so a future extension of the canonical map doesn't
    // silently make the CustomerBookings.tsx alias redundant without anyone
    // noticing (in which case it is harmless, just no longer necessary).
    expect(bookingStatusLabel('pending_provider', 'en')).toBe('PENDING PROVIDER');
  });

  it('CustomerBookings.tsx aliases pending_provider to pending before calling the helper', () => {
    expect(SRC).toMatch(
      /bookingStatusLabel\(\s*booking\.status === 'pending_provider' \? 'pending' : booking\.status,/,
    );
  });
});
