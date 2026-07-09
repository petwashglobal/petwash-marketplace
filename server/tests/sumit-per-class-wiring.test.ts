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
    expect(read('routes/sitter-suite.ts')).toMatch(/paymentClass: 'PROVIDER_BOOKING_COMMISSION'/);
    expect(read('routes/walk-my-pet.ts')).toMatch(/paymentClass: 'PROVIDER_BOOKING_COMMISSION'/);
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
