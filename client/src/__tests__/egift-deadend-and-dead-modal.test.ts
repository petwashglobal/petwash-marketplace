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
  // 2026-09-13: the sealed 410 rail is gone — EGift now pays through the live
  // SUMIT helpers. The intent (never dead-end) is pinned on those: both checkout
  // paths stop the spinner and tell the customer what happened, in both languages.
  it('both checkout paths surface a failure instead of dead-ending', () => {
    for (const [call, flag] of [['startSkuCheckout(', 'if (!result.ok) {'], ['startGuestEgiftCheckout(', 'if (!guest.ok) {']] as const) {
      const at = EGIFT.indexOf(call);
      expect(at, call).toBeGreaterThan(-1);
      const after = EGIFT.slice(at, at + 1400);
      const failAt = after.indexOf(flag);
      expect(failAt, flag).toBeGreaterThan(-1);
      const branch = after.slice(failAt, failAt + 400);
      expect(branch).toContain('setIsProcessing(false)');
      expect(branch).toMatch(/toast\(\{[\s\S]*variant: 'destructive'/);
      expect(branch).toMatch(/לא ניתן להתחיל את התשלום/);
    }
  });
});

describe('the fake-success PAN-collecting modal is gone (2026-07-09)', () => {
  it('BookingPaymentModal.tsx no longer exists', () => {
    const p = path.resolve(__dirname, '..', 'components', 'marketplace', 'BookingPaymentModal.tsx');
    expect(fs.existsSync(p)).toBe(false);
  });
});
