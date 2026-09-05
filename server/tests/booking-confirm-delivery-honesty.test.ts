/**
 * Booking-confirm delivery honesty (audit follow-up).
 *
 * The /confirm response previously reported smsSent/emailSent from mere
 * presence-of-contact-info (`!!ownerPhone`, `!!recipientEmail`) — a customer who
 * paid and got no confirmation was told it was sent. Both flags must reflect the
 * REAL delivery outcome (the provider's send result), matching the existing
 * emailDelivered pattern.
 */

import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

const src = fs.readFileSync(path.resolve(__dirname, '..', 'routes', 'booking-requests.ts'), 'utf8');

describe('handleConfirmCompletion — honest smsSent/emailSent', () => {
  it('captures the real SMS delivery result from twilioSMSService.sendSMS', () => {
    expect(src).toContain('const smsResult = await twilioSMSService.sendSMS(');
    expect(src).toContain('receiptSmsDelivered = !!smsResult?.success');
  });

  it('reports smsSent/emailSent from delivery outcome, not presence of contact info', () => {
    expect(src).toContain('smsSent: receiptSmsDelivered');
    expect(src).toContain('emailSent: receiptEmailDelivered');
    // The old presence-based flags must be gone.
    expect(src).not.toContain('smsSent: !!ownerPhone');
    expect(src).not.toContain('emailSent: !!recipientEmail');
  });
});
