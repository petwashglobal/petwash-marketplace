/**
 * PR-PROVIDER-JOB-DETAIL-STATUS-LABELS — the provider must never see a raw
 * enum literal where a status should be.
 *
 * Originally (#1926) this pinned a STATUS_LABEL map declared inside
 * ProviderJobDetail.tsx, because 7 statuses the server emits had no entry and
 * rendered as the bare enum. #1882 then did the right thing and deleted that
 * per-page map: the screen now calls the ONE canonical map in
 * shared/lib/bookingStatusLabels.ts. The pin kept reading the .tsx for a map
 * that is no longer supposed to be there, so all 18 cases failed and the file
 * went into the red baseline — where the REAL regression in its sibling pin
 * (the deleted payout panel) then hid for a month.
 *
 * Rewritten 2026-09-18 to pin what now has to hold:
 *   1. the screen uses the shared lookup and declares no rival map, and
 *   2. the shared map covers every status the screen can actually receive.
 *
 * The screen reads GET /api/booking-requests/:id, which returns a
 * booking_requests row, so "can actually receive" means the canonical
 * BookingStatus set. Non-canonical legacy strings ('pending_provider',
 * 'quote_sent') live on sitter_bookings / walk_bookings and are rewritten to
 * 'pending' by legacyBookingBridge before they ever reach this screen — which
 * is why the canonical map deliberately omits them.
 */

import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';
import {
  BOOKING_STATUS_LABELS,
  BOOKING_STATUS_TONE,
  bookingStatusLabel,
} from '@shared/lib/bookingStatusLabels';
import { ALL_BOOKING_STATUSES } from '@shared/lib/bookingStateMachine';

const SRC = fs.readFileSync(
  path.resolve(__dirname, 'ProviderJobDetail.tsx'),
  'utf8',
);

describe('ProviderJobDetail — status text comes from the ONE canonical map', () => {
  it('imports the shared lookup and calls it', () => {
    expect(SRC).toMatch(/import\s*\{[^}]*\bbookingStatusLabel\b[^}]*\}\s*from\s*['"]@shared\/lib\/bookingStatusLabels['"]/);
    expect(SRC).toMatch(/bookingStatusLabel\(\s*status\s*,/);
  });

  it('does not declare a rival per-page label map', () => {
    // The whole point of #1882. A second map is how the two sides drift.
    expect(SRC).not.toMatch(/const\s+STATUS_LABEL\b/);
  });
});

describe('the canonical map covers every status this screen can receive', () => {
  for (const status of ALL_BOOKING_STATUSES) {
    it(`${status} has a real bilingual label, not the enum`, () => {
      const pair = BOOKING_STATUS_LABELS[status];
      expect(pair?.en?.trim()).toBeTruthy();
      expect(pair?.he?.trim()).toBeTruthy();
      // The fallback path uppercases the raw string — that is the bug this
      // pin exists to catch, so assert we are not on it.
      expect(bookingStatusLabel(status, 'en')).not.toBe(status.replace(/_/g, ' ').toUpperCase());
      expect(bookingStatusLabel(status, 'he')).toBe(pair.he);
    });
  }

  it('reviewed is a neutral post-completion state, not an alarm', () => {
    expect(BOOKING_STATUS_TONE.reviewed).toBe('neutral');
  });

  it('an unknown status is made VISIBLE, never silently blank', () => {
    // Bad data from a writer we have not fixed yet must be obvious on screen.
    expect(bookingStatusLabel('pending_provider', 'en')).toBe('PENDING PROVIDER');
    expect(bookingStatusLabel(undefined, 'en')).toBe('—');
  });
});
