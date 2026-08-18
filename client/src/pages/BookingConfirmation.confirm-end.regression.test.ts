/**
 * PR-CUSTOMER-CONFIRM-END-1 — regression pin for the "confirm end of service"
 * gate on BookingConfirmation.tsx.
 *
 * BEFORE THIS PR (silent P0 UX bug):
 *   const canConfirm = isOwner && booking.status === 'completed' && !confirmed;
 *
 * The server contract at server/routes/booking-requests.ts:2817 is:
 *   if (booking.status !== 'provider_marked_complete') {
 *     return res.status(400).json({ error: `Cannot confirm booking with status: ...` });
 *   }
 *
 * → the customer's Confirm & Send Notifications form only rendered when the
 *   booking was already 'completed', at which point calling /confirm returns
 *   400. In practice: the button was DEAD, the review capture was DEAD, and
 *   every booking waited 24h for the auto-approve cron to fire. Rover / MadPaws
 *   both show this "please confirm end of stay, then rate" step immediately
 *   after the provider marks the service done.
 *
 * These pins lock the correct gate in place and require the Mad-Paws-style
 * banner to keep rendering above the confirm form.
 */

import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

const SRC = fs.readFileSync(
  path.resolve(__dirname, 'BookingConfirmation.tsx'),
  'utf8',
);

describe('BookingConfirmation — PR-CUSTOMER-CONFIRM-END-1 gate pin', () => {
  it('canConfirm gates on provider_marked_complete (matches server contract)', () => {
    expect(SRC).toMatch(
      /canConfirm\s*=\s*isOwner\s*&&\s*booking\.status\s*===\s*['"`]provider_marked_complete['"`]/,
    );
  });

  it('never re-introduces the dead "canConfirm = ... status === completed" gate', () => {
    expect(SRC).not.toMatch(
      /canConfirm\s*=\s*isOwner\s*&&\s*booking\.status\s*===\s*['"`]completed['"`]/,
    );
  });

  it('mounts the Rover/MadPaws-parity end-of-stay banner (data-testid)', () => {
    expect(SRC).toContain('data-testid="end-of-stay-banner"');
  });

  it('confirm mutation still POSTs to /api/booking-requests/:id/confirm', () => {
    expect(SRC).toMatch(
      /apiRequest\(\s*['"`]POST['"`]\s*,\s*`\/api\/booking-requests\/\$\{requestId\}\/confirm`/,
    );
  });

  it('carries HE + EN copy for the end-of-stay banner', () => {
    // HE lead
    expect(SRC).toContain('הספק דיווח שהשירות הושלם');
    // EN lead
    expect(SRC).toContain('Your provider marked the service as done');
  });
});
