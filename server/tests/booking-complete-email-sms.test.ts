/**
 * provider_marked_complete → customer email/SMS — regression pin (2026-07-09).
 *
 * Booking keep-in-loop audit: when a provider marks a service complete, the
 * customer had a 24-hour window to confirm/dispute before the auto-approve cron
 * releases their payment — but they were only notified via an in-app inbox row
 * (channels: ['in_app']). If they weren't in the app, they got NO email and NO
 * SMS, and their money auto-released without them ever knowing. This is a MONEY
 * deadline, so it must reach them off-app.
 *
 * Fix: the in-app row is kept, and a dispatchNotification with channels
 * ['email','sms'] is added (dispatchNotification resolves the owner's email/phone
 * from their uid). Non-fatal / fire-and-forget.
 *
 * Source-level pin (same style as credit-wallet-confirm-idor.test.ts).
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

const SRC = fs.readFileSync(path.resolve(__dirname, '..', 'routes', 'booking-requests.ts'), 'utf8');

// Anchor on the unique KEEP-IN-LOOP block added by this fix (avoids fragile
// splitting on 'provider_marked_complete', which appears many times).
const block = SRC.split('KEEP-IN-LOOP (2026-07-09)')[1]?.slice(0, 1400) ?? '';

describe('provider_marked_complete notifies the customer by email + SMS (2026-07-09)', () => {
  it('sends a dispatchNotification to the booking owner', () => {
    expect(block).toMatch(/dispatchNotification\(\{[\s\S]*?uid: booking\.ownerId/);
  });

  it('sends via email + SMS (off-app), not in-app only', () => {
    expect(block).toMatch(/channels: \['email', 'sms'\]/);
    expect(block).toMatch(/actionType: 'approve_completion'/);
  });

  it("tells the customer about the 24-hour auto-release deadline", () => {
    expect(block).toMatch(/24 שעות|within 24 hours/);
  });

  it('is fire-and-forget (non-fatal — cannot break marking complete)', () => {
    expect(SRC).toMatch(/provider_marked_complete email\/SMS failed \(non-fatal\)/);
  });
});
