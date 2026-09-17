/**
 * MarketplaceBookingFlow showed "Credits Applied −₪150 / Pay ₪310" and posted
 * creditBreakdown + redemptionSessionId. /checkout never read either: it
 * charged quote.totalCents (₪460) and the redemption session — only
 * 'code_generated', never confirmed — expired with the credit unspent.
 * The customer was over-charged by the credit amount.
 *
 * Until credits are applied server-side and the remainder charged: the screen
 * does not offer credits here, and the route refuses the fields.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(__dirname, '..', '..');
const read = (p: string) => readFileSync(join(ROOT, p), 'utf8');

describe('checkout refuses credit fields', () => {
  const src = read('server/routes/marketplace-bookings.ts');
  const handler = src.slice(src.indexOf("router.post('/:quoteId/checkout'"), src.indexOf('Quote ownership'));

  it('400 CREDITS_NOT_SUPPORTED_HERE before anything is charged', () => {
    expect(handler).toContain("if (req.body?.creditBreakdown || req.body?.redemptionSessionId) {");
    expect(handler).toContain("errorCode: 'CREDITS_NOT_SUPPORTED_HERE'");
    const guard = handler.indexOf('CREDITS_NOT_SUPPORTED_HERE');
    const charge = src.indexOf('createPaymentSession');
    expect(guard).toBeLessThan(charge);
  });

  it('the charge is still the quote total', () => {
    expect(src).toContain('amountCents: quote.totalCents || 0,');
  });
});

describe('the screen no longer promises a discount it cannot give', () => {
  const src = read('client/src/pages/MarketplaceBookingFlow.tsx');

  it('no credit card, no credit fields, no "Pay ₪<cash>" button', () => {
    expect(src).not.toContain('CreditWalletCard');
    expect(src).not.toContain('appliedCredits');
    expect(src).not.toContain('creditBreakdown');
    expect(src).not.toMatch(/Covered by Credits|Credits Applied|Paid in full by your/);
  });

  it('says plainly that credits are not usable here', () => {
    expect(src).toContain('data-testid="credits-not-available"');
    expect(src).toContain('Wallet credits cannot be used for this booking');
  });
});
