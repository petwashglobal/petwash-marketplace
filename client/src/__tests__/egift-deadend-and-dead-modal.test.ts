/**
 * eGift dead-end + dead fake-payment modal — regression pins (2026-07-09).
 *
 * (1) /egift (EGift.tsx) posted to /api/multi-service-gift, which is permanently
 *     sealed (HTTP 410, the old free-mint hole #1184). The handler only special-
 *     cased 503, so a 410 fell through to a generic "error creating gift card"
 *     toast — a dead-end on the flagship gift page. Now there's an honest 410
 *     branch pointing at the working Gift Cards page.
 *
 * (2) BookingPaymentModal.tsx collected a raw card PAN client-side and showed a
 *     FAKE "Payment successful!" on any 2xx while the booking was only
 *     payment_pending. It had ZERO renderers. Deleted so it can't be re-wired.
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

const EGIFT = fs.readFileSync(
  path.resolve(__dirname, '..', 'pages', 'EGift.tsx'),
  'utf8',
);

describe('eGift checkout no longer dead-ends on the sealed rail (2026-07-09)', () => {
  it('handles HTTP 410 with an honest coming-soon next-step', () => {
    expect(EGIFT).toMatch(/response\.status === 410/);
    expect(EGIFT.toLowerCase()).toMatch(/coming soon|תיפתח בקרוב/);
  });
});

describe('the fake-success PAN-collecting modal is gone (2026-07-09)', () => {
  it('BookingPaymentModal.tsx no longer exists', () => {
    const p = path.resolve(__dirname, '..', 'components', 'marketplace', 'BookingPaymentModal.tsx');
    expect(fs.existsSync(p)).toBe(false);
  });
});
