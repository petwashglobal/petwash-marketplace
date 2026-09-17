import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

/**
 * 2026-09-17: a booking paid on SUMIT's hosted page was recorded as
 * paymentMethod 'nayax', status-history "created via Nayax" and deal-gate
 * paymentProvider 'NAYAX' — and paymentMethod came from the request body.
 * The record must name the rail the server actually used.
 */
const src = readFileSync(resolve(__dirname, '..', 'routes', 'booking-requests.ts'), 'utf8');
const pay = src.slice(src.indexOf("router.post('/:requestId/pay'"), src.indexOf("router.get('/:requestId/sumit-return'"));

describe('POST /:requestId/pay records the real card rail', () => {
  it('derives the label from BOOKING_CARD_RAIL', () => {
    expect(pay).toContain("const cardRail = (process.env.BOOKING_CARD_RAIL || 'nayax').trim().toLowerCase();");
    expect(pay).toContain("const railName = cardRail === 'sumit' ? 'SUMIT' : 'Nayax';");
    expect(pay).toContain("const railMethod = cardRail === 'sumit' ? 'sumit' : 'nayax';");
  });
  it('booking, history and deal-gate audit use it', () => {
    expect(pay).toContain('paymentMethod: railMethod,');
    expect(pay).toContain('Payment session created via ${railName}.');
    expect(pay).toContain('paymentProvider: railName.toUpperCase(),');
    expect(pay).not.toContain("paymentProvider: 'NAYAX'");
    expect(pay).not.toMatch(/paymentMethod:\s*paymentMethod/);
  });
  it('never reads the rail or transaction from the request body', () => {
    expect(pay).not.toMatch(/const \{[^}]*paymentMethod[^}]*\}\s*=\s*req\.body/);
  });
});
