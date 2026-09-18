/**
 * booking-fullcircle.test.ts
 *
 * Characterization test for the booking "circle" across every platform:
 *   booking id → user id → date → transaction # → VAT → tax invoice → email
 *
 * Source-introspection (the repo's established no-DB test style): it reads the
 * live service/route source and asserts which links are wired. It does two jobs:
 *   1. GUARDS the COMPLETE circles (unified-booking, shop, sitter) against
 *      regression — if someone removes the receipt/txn/email wiring, this fails.
 *   2. PINS the known GAPS (K9000, trainer, walk) so they are tracked — when a
 *      gap is fixed, the matching assertion flips and reminds us to update it.
 *
 * Plus: validates the Israeli VAT math (18%, VAT-inclusive split) and the
 * per-platform ID formats. Runs with `vitest` — no DB, no network.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const ROOT = resolve(__dirname, '..', '..');
const src = (rel: string) => readFileSync(resolve(ROOT, rel), 'utf8');

describe('VAT math (Israeli 18%, VAT-inclusive split)', () => {
  const VAT_RATE = 0.18;
  // The split IsraeliDigitalReceiptService.calculateVATBreakdown uses:
  //   net = total / (1 + rate);  vat = total - net.
  const split = (totalIls: number) => {
    const net = totalIls / (1 + VAT_RATE);
    const vat = totalIls - net;
    return { net, vat };
  };

  it('VAT rate constant defaults to 18% (env-overridable via VAT_RATE)', () => {
    const cfg = src('shared/israel-compliance-config.ts');
    // The constant is now env-aware (VAT_RATE override) but still defaults to 0.18.
    expect(cfg).toMatch(/export const ISRAEL_VAT_RATE\s*=/);
    expect(cfg).toMatch(/:\s*0\.18;/);
  });

  it.each([100, 117, 250, 1500, 5500 / 100])('net+vat reconstructs the gross for ₪%s', (total) => {
    const { net, vat } = split(total);
    expect(+(net + vat).toFixed(2)).toBe(+total.toFixed(2));
    // VAT is ~15.254% of the VAT-inclusive gross (= 18% of net).
    expect(+(vat / net).toFixed(4)).toBe(0.18);
  });
});

describe('Per-platform booking-id formats', () => {
  it('sitter uses SITTER_<id>', () => expect(src('server/routes/sitter-suite.ts')).toMatch(/SITTER_/));
  it('walk uses WALK-<year>-<id>', () => expect(src('server/routes/walk-my-pet.ts')).toMatch(/WALK-/));
  it('trainer uses TRN-<year>-<id>', () => expect(src('server/routes/academy.ts')).toMatch(/TRN-/));
  it('unified uses bkg_<id>', () => expect(src('server/services/unified-booking/UnifiedBookingEngine.ts')).toMatch(/bkg_/));
  it('unified transaction uses txn_<id> in super_app_payments', () =>
    expect(src('server/services/unified-booking/TransactionStampService.ts')).toMatch(/txn_|superAppPayments/));
});

describe('COMPLETE circles — must stay wired (regression guard)', () => {
  it('unified-booking: txn stamp + VAT receipt + real customer email', () => {
    const eng = src('server/services/unified-booking/UnifiedBookingEngine.ts');
    expect(eng).toMatch(/generateReceipt/);
    expect(eng).toMatch(/customerEmail:\s*receiptData/); // real email, not ''
    expect(src('server/services/unified-booking/TransactionStampService.ts')).toMatch(/superAppPayments/);
  });

  it('shop order: wallet txn + tax invoice + confirmation email', () => {
    expect(src('server/routes/shop.ts')).toMatch(/deductFromWallet|transactionId/);
    expect(src('server/services/ShopService.ts')).toMatch(/generateTaxInvoice|IsraeliInvoiceGenerator/);
    expect(src('server/routes/shop.ts')).toMatch(/sendLuxuryEmail|shopOrderConfirmation/);
  });

  it('sitter: nayax payment txn + receipt + notification', () => {
    // 2026-09-18: the accept path moved OUT of the route into
    // acceptSitterBookingCore. The route kept the Nayax import, so the first
    // half of this pin still matched and only the receipt half failed —
    // a pin that reads the wrong file reports the wrong thing either way.
    expect(src('server/routes/sitter-suite.ts')).toMatch(/processBookingPayment|nayaxSitterMarketplace/);
    const core = src('server/services/booking-response/acceptSitterBookingCore.ts');
    expect(core).toMatch(/generateReceipt/);
    // And never for money that was not collected — a SIM_ payment must not
    // produce a חשבונית.
    expect(core).toMatch(/SIM_/);
  });
});

describe('KNOWN GAPS — pinned until fixed (flip the assertion when wired)', () => {
  it('K9000 wash issues NO customer tax invoice', () => {
    // When a wash receipt is wired, this should FAIL → update the matrix.
    expect(src('server/routes/k9000.ts')).not.toMatch(/generateReceipt|createCustomerReceipt/);
  });

  it('Trainer/academy NOW issues a fiscal receipt on confirm (gap fixed)', () => {
    expect(src('server/routes/academy.ts')).toMatch(/generateReceipt/);
  });

  // FLIPPED 2026-09-18 (#2595 wired the card rail). This used to assert that a
  // walk issues NO receipt: money was never collected on accept — moveToEscrow
  // only wrote a Firestore doc — so a tax document there was a false ITA
  // filing. The pin said "restore a receipt pin only when a verified payment
  // rail lands here." It has landed, so the assertion flips.
  //
  // What matters now is WHERE. The receipt belongs at COMPLETION, after the
  // money is real — never at accept, which is the original bug.
  it('a walk issues its customer receipt at COMPLETION, never at accept', () => {
    const wmp = src('server/routes/walk-my-pet.ts');
    expect(wmp).toMatch(/generateReceipt\(/);

    const completeAt = wmp.indexOf("router.post('/walks/:bookingId/complete'");
    const receiptAt = wmp.indexOf('IsraeliDigitalReceiptService.generateReceipt(');
    expect(completeAt).toBeGreaterThan(-1);
    expect(receiptAt).toBeGreaterThan(completeAt);

    // The accept handler must still issue nothing.
    const acceptAt = wmp.indexOf("router.post('/walks/:bookingId/accept'");
    if (acceptAt > -1) {
      const acceptBlock = wmp.slice(acceptAt, completeAt > acceptAt ? completeAt : acceptAt + 4000);
      expect(acceptBlock).not.toMatch(/generateReceipt\(/);
    }

    // And a SUMIT hiccup must never eat the document: it goes through the
    // durable outbox, and a failure to complete the booking is not acceptable
    // either, so the receipt is non-blocking.
    expect(wmp).toMatch(/runFiscalDocumentAndPersistOnFailure/);
    expect(wmp).toMatch(/sourceKey: `walk:\$\{bookingId\}`/);
  });

  it('Sitter receipt resolves the real customer email (gap fixed)', () => {
    // The empty-string default that silently dropped the receipt email is gone;
    // the accept path looks the owner's email up from the users table. It lives
    // in acceptSitterBookingCore since the route was split (2026-09-18) — the
    // pin was still reading sitter-suite.ts and so reported a fixed gap as open.
    expect(src('server/services/booking-response/acceptSitterBookingCore.ts'))
      .toMatch(/customerEmail:\s*owner\?\.email/);
  });
});
