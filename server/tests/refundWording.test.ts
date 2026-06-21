import { describe, it, expect } from 'vitest';
import { buildRefundPendingSms, buildRefundIssuedSms } from '../services/PetWashNotificationEngine';

/**
 * Guards the refund-wording truth invariant.
 *
 * Bug this locks down: a booking cancellation used to send "זיכוי הועבר ↩️"
 * (refund TRANSFERRED) + a refund receipt, while the actual customer refund is
 * still a TODO (no money moves). The PENDING message must never claim the money
 * was sent; the ISSUED message is reserved for when a refund has truly executed.
 */
describe('refund SMS wording — pending must not claim money moved', () => {
  const args = { bookingRef: 'PW-123', refundAmount: '55.00' };

  it('pending SMS says "received / under review", never "transferred"', () => {
    const s = buildRefundPendingSms(args);
    expect(s).toContain('בקשת זיכוי התקבלה'); // refund request received
    expect(s).toContain('בבדיקה');            // under review
    expect(s).not.toContain('הועבר');          // must NOT say "transferred"
    expect(s).not.toMatch(/ימי עסקים/);        // no "will arrive in N business days" promise
  });

  it('pending SMS still carries the booking ref and amount', () => {
    const s = buildRefundPendingSms(args);
    expect(s).toContain('PW-123');
    expect(s).toContain('55.00');
  });

  it('issued SMS (reserved for a real, executed refund) DOES say "transferred"', () => {
    const s = buildRefundIssuedSms(args);
    expect(s).toContain('הועבר'); // only valid once money actually moved
  });
});
