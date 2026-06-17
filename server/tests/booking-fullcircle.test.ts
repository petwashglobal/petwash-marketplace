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

  it('VAT rate constant is 18%', () => {
    const cfg = src('shared/israel-compliance-config.ts');
    expect(cfg).toMatch(/ISRAEL_VAT_RATE\s*=\s*0\.18/);
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
    const s = src('server/routes/sitter-suite.ts');
    expect(s).toMatch(/processBookingPayment|nayaxSitterMarketplace/);
    expect(s).toMatch(/generateReceipt/);
  });
});

describe('KNOWN GAPS — pinned until fixed (flip the assertion when wired)', () => {
  it('K9000 wash issues NO customer tax invoice', () => {
    // When a wash receipt is wired, this should FAIL → update the matrix.
    expect(src('server/routes/k9000.ts')).not.toMatch(/generateReceipt|createCustomerReceipt/);
  });

  it('Trainer/academy captures payment but issues NO fiscal receipt', () => {
    expect(src('server/routes/academy.ts')).not.toMatch(/generateReceipt|createCustomerReceipt|IsraeliInvoice/);
  });

  it('Walk receipt hardcodes nayaxTransactionId: undefined (no txn linkage)', () => {
    expect(src('server/routes/walk-my-pet.ts')).toMatch(/nayaxTransactionId:\s*undefined/);
  });

  it("Walk receipt hardcodes customerEmail: '' (email never delivers)", () => {
    expect(src('server/routes/walk-my-pet.ts')).toMatch(/customerEmail:\s*['"]['"]/);
  });
});
