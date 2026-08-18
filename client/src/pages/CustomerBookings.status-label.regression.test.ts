/**
 * PR-CUSTOMER-BOOKINGS-STATUS-LABEL — regression pin for the STATUS_LABELS
 * map coverage on CustomerBookings.tsx.
 *
 * Before: provider_marked_complete (and meet_greet_requested + pending_provider)
 * were not in the map, so the status pill rendered the raw enum literal
 * ("provider_marked_complete") instead of a friendly bilingual label.
 * The fallback at line ~511 shows `booking.status` verbatim on unknown keys.
 *
 * Companion to PR-CUSTOMER-BOOKINGS-REVIEW-CTA (#1916) — that PR added an
 * actionable "Confirm & rate" button for the same status. Without a friendly
 * label the customer saw the raw enum next to the button, which reads as a
 * broken UI.
 */

import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

const SRC = fs.readFileSync(
  path.resolve(__dirname, 'CustomerBookings.tsx'),
  'utf8',
);

describe('CustomerBookings — STATUS_LABELS coverage pin', () => {
  it('provider_marked_complete has a friendly HE + EN label', () => {
    expect(SRC).toMatch(
      /provider_marked_complete:\s*\{\s*he:\s*['"]ממתין לאישור סיום['"]/,
    );
    expect(SRC).toMatch(
      /provider_marked_complete:[\s\S]{0,120}en:\s*['"]Awaiting your confirmation['"]/,
    );
  });

  it('meet_greet_requested has a label (was missing before)', () => {
    expect(SRC).toMatch(
      /meet_greet_requested:\s*\{\s*he:[^}]+en:\s*['"]Meet & Greet requested['"]/,
    );
  });

  it('pending_provider (legacy sitter/walk) has a label', () => {
    expect(SRC).toMatch(/pending_provider:\s*\{\s*he:[^}]+en:\s*['"]Pending['"]/);
  });

  it('does not remove any pre-existing label (regression pin: all originals still present)', () => {
    const REQUIRED = [
      'pending', 'accepted', 'confirmed', 'meet_greet_scheduled',
      'meet_greet_completed', 'payment_pending', 'in_progress',
      'completed', 'reviewed', 'declined', 'cancelled', 'disputed',
    ];
    for (const key of REQUIRED) {
      expect(SRC).toMatch(new RegExp(`\\b${key}:\\s*\\{\\s*he:`));
    }
  });
});
