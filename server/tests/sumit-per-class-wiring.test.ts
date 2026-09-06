/**
 * Per-class SUMIT document wiring at the point of sale — regression pin (2026-07-09).
 *
 * Connects the CPA mapping engine (#1359) to actual issuance: generateReceipt now
 * carries a paymentClass, looks up getSumitDocumentMapping, and passes the correct
 * SUMIT documentType to createCustomerReceipt. Every caller declares its class so
 * that when SUMIT is the issuer (isWired()) each sale creates the right SUMIT
 * document — wash/shop → InvoiceAndReceipt, top-up/eGift → Receipt, marketplace →
 * Invoice on commission. Inert until SUMIT is switched on.
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

const repo = path.resolve(__dirname, '..');
const read = (p: string) => fs.readFileSync(path.join(repo, p), 'utf8');
const SVC = read('services/IsraeliDigitalReceiptService.ts');

describe('generateReceipt wires payment class → SUMIT document type (2026-07-09)', () => {
  it('accepts a paymentClass and resolves the doc type from the CPA mapping', () => {
    expect(SVC).toMatch(/paymentClass\?: PetWashPaymentClass/);
    expect(SVC).toMatch(/getSumitDocumentMapping\(params\.paymentClass\)\.documentType/);
    expect(SVC).toMatch(/documentType: classDocType && classDocType !== 'CreditInvoice'/);
  });

  it('every generateReceipt caller declares its payment class', () => {
    // Sitter Suite: the declaration moved, it was not removed. The whole
    // `action === 'accept'` branch of routes/sitter-suite.ts — atomic claim,
    // Nayax capture, escrow, the SIM_ guard and this generateReceipt call —
    // was extracted into services/booking-response/acceptSitterBookingCore.ts
    // by commit 68d9d0b4e (PR #2166, 2026-08-28). routes/sitter-suite.ts
    // therefore no longer calls generateReceipt itself; it awaits the core, and
    // so does BookingResponseDispatcher's SITTER accept branch. Pin the core
    // (where the call lives now) AND both entry points' delegation, so
    // re-inlining either branch without the receipt fails here again.
    //
    // Scope of this pin: it proves the ROUTING is intact — that a Sitter accept
    // still reaches generateReceipt carrying the class. It does not prove any
    // individual SUMIT document was issued: the SUMIT dispatch inside
    // generateReceipt is deliberately non-blocking (a missing document id logs
    // a warning, a throw logs an error) so a SUMIT hiccup can never fail a
    // receipt for an already-captured payment. Issuance completeness is a
    // data-reconciliation question, not a code-path one.
    expect(read('services/booking-response/acceptSitterBookingCore.ts'))
      .toMatch(/paymentClass: 'PROVIDER_BOOKING_COMMISSION'/);
    expect(read('routes/sitter-suite.ts')).toMatch(/acceptSitterBookingCore\(/);
    expect(read('services/booking-response/BookingResponseDispatcher.ts'))
      .toMatch(/acceptSitterBookingCore\(/);
    // What that class resolves to (Invoice / VAT_ON_COMMISSION_ONLY /
    // PETWASH_DISCLOSED_AGENT) stays pinned in sumit-document-mapping.test.ts.
    // walk-my-pet no longer calls generateReceipt at all (2026-07-30): its
    // accept path collects no money, so it may not issue a fiscal document.
    expect(read('routes/walk-my-pet.ts')).not.toMatch(/generateReceipt\(/);
    expect(read('routes/academy.ts')).toMatch(/paymentClass: 'PROVIDER_BOOKING_COMMISSION'/);
    expect(read('services/unified-booking/UnifiedBookingEngine.ts')).toMatch(/paymentClass: 'PROVIDER_BOOKING_COMMISSION'/);
    expect(read('services/ShopService.ts')).toMatch(/paymentClass: 'SHOP_ITEM'/);
  });

  it('the purchases spine maps stored-value modules to the deferred classes', () => {
    const PA = read('services/PurchaseActivationService.ts');
    expect(PA).toMatch(/item\.module === 'gift' \? 'EGIFT_PURCHASE'/);
    expect(PA).toMatch(/item\.module === 'wallet' \? 'WALLET_TOPUP'/);
  });
});
