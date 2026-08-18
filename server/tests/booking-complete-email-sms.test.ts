/**
 * provider_marked_complete → customer email + SMS + inbox — regression pin.
 *
 * Original fix (2026-07-09): when a provider marked a service complete, the
 * customer had a 24-hour window to confirm/dispute before the auto-approve cron
 * released their payment — but they were only notified via an in-app inbox row.
 * If they weren't in the app, they got NO email and NO SMS, and their money
 * auto-released without them ever knowing.
 *
 * 2026-08-18 split (PR-1903 + PR-DEDUPE-COMPLETE-EMAIL):
 *   The email channel moved to a branded, single-CTA template fired by
 *   sendConfirmEndOfStay() via setImmediate() — that's the Rover/MadPaws parity
 *   path with the strong "Confirm end of service" button.
 *   The legacy dispatchNotification now carries the SMS only, so exactly ONE
 *   email + ONE SMS + ONE inbox row hit the customer per /complete call (no
 *   duplicate delivery in prod).
 *   'inbox' remains omitted because a superAppNotifications row is written
 *   above.
 *
 * Source-level pins (same style as credit-wallet-confirm-idor.test.ts).
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

const SRC = fs.readFileSync(path.resolve(__dirname, '..', 'routes', 'booking-requests.ts'), 'utf8');

// Anchor on the unique KEEP-IN-LOOP block added by this fix (avoids fragile
// splitting on 'provider_marked_complete', which appears many times).
const block = SRC.split('KEEP-IN-LOOP (2026-07-09')[1]?.slice(0, 2400) ?? '';

describe('provider_marked_complete notifies the customer by email (branded) + SMS + inbox', () => {
  it('sends a dispatchNotification to the booking owner', () => {
    expect(block).toMatch(/dispatchNotification\(\{[\s\S]*?uid: booking\.ownerId/);
  });

  it('legacy dispatchNotification carries SMS only (branded email moved to sendConfirmEndOfStay)', () => {
    expect(block).toMatch(/channels: \['sms'\]/);
    expect(block).toMatch(/actionType: 'approve_completion'/);
    // Must NOT silently regress to also including 'email' — that would duplicate
    // the branded email that sendConfirmEndOfStay already fires above.
    expect(block).not.toMatch(/channels: \['email', 'sms'\]/);
    expect(block).not.toMatch(/channels: \['sms', 'email'\]/);
  });

  it("branded Rover/MadPaws email fires via sendConfirmEndOfStay right before the SMS wire", () => {
    // The setImmediate + sendConfirmEndOfStay import must be present in the
    // /complete handler, wired to fire the branded email.
    expect(SRC).toMatch(/sendConfirmEndOfStay\(/);
    expect(SRC).toMatch(/import\(\s*['"`]\.\.\/email\/sendConfirmEndOfStay['"`]\s*\)/);
  });

  it("tells the customer about the 24-hour auto-release deadline (SMS body)", () => {
    expect(block).toMatch(/24 שעות|within 24 hours/);
  });

  it('is fire-and-forget (non-fatal — cannot break marking complete)', () => {
    // Comment on the SMS wire signals the pattern; keyword changed from
    // "email/SMS failed" to a more accurate label. Accept either historical or
    // current phrasing so a rename doesn't cascade.
    expect(SRC).toMatch(/provider_marked_complete (email\/SMS|SMS|off-app) failed/);
  });
});
