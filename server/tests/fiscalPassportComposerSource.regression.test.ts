/**
 * Fiscal composer branch invariants — CEO 2026-08-27 §94 items 8-15.
 *
 * Structural pins on server/services/fiscalPassport/composer.ts. The
 * composer is a heavy DB reader; we pin the SHAPE of each branch so a
 * refactor can't silently:
 *   • invent a tax decision at route level (§21, §72-73);
 *   • grant PROVIDER fulfiller kind to SHOP / K9000 / EGIFT (§4-5);
 *   • splice raw ids into pool.query (SQL-injection guard);
 *   • return non-null for a non-participant viewer (§34, §71);
 *   • report PAID for a walk with no payment rail (§24).
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

const SRC = fs.readFileSync(
  path.resolve(__dirname, '..', 'services', 'fiscalPassport', 'composer.ts'),
  'utf8',
);

function windowOf(name: string): string {
  // Accept both `async function` and plain `function` forms — some
  // shared helpers (buildBookingFiscal) are sync.
  let start = SRC.indexOf(`async function ${name}(`);
  if (start < 0) start = SRC.indexOf(`function ${name}(`);
  if (start < 0) throw new Error(`${name} not found`);
  // Next function of either shape marks the window's end.
  const nextAsync = SRC.indexOf('\nasync function ', start + name.length + 10);
  const nextSync = SRC.indexOf('\nfunction ', start + name.length + 10);
  const candidates = [nextAsync, nextSync].filter((n) => n > 0);
  const end = candidates.length ? Math.min(...candidates) : SRC.length;
  return SRC.slice(start, end);
}

describe('composer — every branch delegates tax to getSumitDocumentMapping (§21, §73)', () => {
  it('every branch calls fiscalDocumentFromCPA, never composes its own doc type', () => {
    const branches = [
      'composeShopFiscal',
      'composeK9000Fiscal',
      'composeEgiftPurchaseFiscal',
      'composeEgiftRedemptionFiscal',
      'composeWalletTopupFiscal',
      'composeSitterFiscal',
      'composeWalkFiscal',
      'composeAcademyFiscal',
    ];
    for (const b of branches) {
      const w = windowOf(b);
      // Either the branch delegates directly, OR it uses buildBookingFiscal
      // which delegates via fiscalDocumentFromCPA.
      const direct = /fiscalDocumentFromCPA\(/.test(w);
      const throughShared = /buildBookingFiscal\(/.test(w);
      expect(direct || throughShared, `${b} must call fiscalDocumentFromCPA (directly or via buildBookingFiscal)`).toBe(true);
    }
  });

  it('no branch builds a documentType literal — the CPA mapping owns that', () => {
    // A refactor that hard-codes documentType: 'InvoiceAndReceipt'
    // (or Receipt / Invoice / CreditInvoice) in a branch bypasses
    // the CPA mapping. Ban file-wide except inside fiscalDocumentFromCPA.
    const helperStart = SRC.indexOf('function fiscalDocumentFromCPA');
    const helperEnd = SRC.indexOf('\nfunction ', helperStart + 10);
    const beforeHelper = SRC.slice(0, helperStart);
    const afterHelper = SRC.slice(helperEnd);
    const forbidden = /documentType:\s*['"](InvoiceAndReceipt|Receipt|Invoice|CreditInvoice)['"]/;
    expect(beforeHelper).not.toMatch(forbidden);
    expect(afterHelper).not.toMatch(forbidden);
  });
});

describe('SHOP branch (§94.8)', () => {
  const w = windowOf('composeShopFiscal');
  it('fulfiller kind is PETWASH_MERCHANT — never PROVIDER', () => {
    expect(w).toMatch(/kind:\s*['"]PETWASH_MERCHANT['"]/);
    expect(w).not.toMatch(/kind:\s*['"]PROVIDER['"]/);
  });
  it('raw SQL is parameterised on shop_orders', () => {
    expect(w).toMatch(/WHERE id = \$1/);
    expect(w).toMatch(/pool\.query\([\s\S]*?,\s*\[orderId\]/);
    expect(w).not.toMatch(/WHERE id = \$\{orderId\}/);
  });
  it('non-owner + non-staff → null (privacy 404)', () => {
    expect(w).toMatch(/if\s*\(!isOwner\s*&&\s*!isStaff\)\s*return\s+null/);
  });
});

describe('K9000 branch (§94.9)', () => {
  const w = windowOf('composeK9000Fiscal');
  it('fulfiller kind is MACHINE — encodes station+bay', () => {
    expect(w).toMatch(/kind:\s*['"]MACHINE['"]/);
    expect(w).toMatch(/event\.stationId[\s\S]*event\.baySide/);
  });
  it('public-card path uses K9000_PUBLIC_CARD_COMPLETED, PetWash-side uses K9000_WASH_COMPLETED', () => {
    expect(w).toMatch(/K9000_PUBLIC_CARD_COMPLETED/);
    expect(w).toMatch(/K9000_WASH_COMPLETED/);
  });
});

describe('EGIFT PURCHASE branch (§94.10)', () => {
  const w = windowOf('composeEgiftPurchaseFiscal');
  it('customer identified by senderEmail (case-insensitive)', () => {
    expect(w).toMatch(/senderEmail/);
    expect(w).toMatch(/\.toLowerCase\(\)/);
  });
  it('line item vatTreatment is NO_VAT_STORED_VALUE (CPA #5)', () => {
    expect(w).toMatch(/EGIFT_PURCHASE['"]?,\s*1,\s*total,\s*['"]NO_VAT_STORED_VALUE['"]/);
  });
});

describe('EGIFT REDEMPTION branch (§94.11)', () => {
  const w = windowOf('composeEgiftRedemptionFiscal');
  it('reads from credit_transactions with parameterised SQL', () => {
    expect(w).toMatch(/FROM credit_transactions/);
    expect(w).toMatch(/pool\.query\([\s\S]*?,\s*\[ledgerId\]/);
  });
  it('line item vatTreatment is VAT_AT_REDEMPTION (CPA #5 tax event)', () => {
    expect(w).toMatch(/EGIFT_REDEMPTION_SERVICE['"]?,\s*1,\s*total,\s*['"]VAT_AT_REDEMPTION['"]/);
  });
});

describe('WALLET TOPUP branch (§94.12)', () => {
  const w = windowOf('composeWalletTopupFiscal');
  it('reads from credit_transactions (transaction_type = issue)', () => {
    expect(w).toMatch(/FROM credit_transactions/);
    expect(w).toMatch(/transaction_type\s*=\s*'issue'/);
  });
  it('line item vatTreatment is NO_VAT_STORED_VALUE (CPA — tax deferred)', () => {
    expect(w).toMatch(/WALLET_TOPUP['"]?,\s*1,\s*total,\s*['"]NO_VAT_STORED_VALUE['"]/);
  });
});

describe('booking branches — sitter/walk/academy share buildBookingFiscal', () => {
  it('sitter/walk/academy delegate to buildBookingFiscal', () => {
    for (const b of ['composeSitterFiscal', 'composeWalkFiscal', 'composeAcademyFiscal']) {
      expect(windowOf(b)).toMatch(/return buildBookingFiscal\(/);
    }
  });
  it('WALK is honestly reported as unpaid until a real rail lands (§24)', () => {
    const w = windowOf('composeWalkFiscal');
    // The composer sets `const paid = false;` for walk today.
    expect(w).toMatch(/const\s+paid\s*=\s*false/);
  });
  it('buildBookingFiscal tags booking lines with VAT_ON_COMMISSION_ONLY (§20 disclosed-agent)', () => {
    const w = windowOf('buildBookingFiscal');
    expect(w).toMatch(/vatTreatment:\s*['"]VAT_ON_COMMISSION_ONLY['"]/);
  });
  it('providerMoney is only surfaced to provider viewer or admin/staff (§22)', () => {
    const w = windowOf('buildBookingFiscal');
    expect(w).toMatch(/\(a\.isProvider\s*\|\|\s*a\.isStaff\)/);
  });
});

describe('dispatch switch — every FiscalSourceHint has a branch', () => {
  it('composeFiscalPassport switch covers every registered source', () => {
    for (const source of [
      'shop_orders',
      'k9000_wash_events',
      'egift_guest_orders_purchase',
      'egift_guest_orders_redemption',
      'wallet_topup',
      'sitter_bookings',
      'walk_bookings',
      'trainer_bookings',
    ]) {
      expect(SRC).toMatch(new RegExp(`case\\s+['"]${source}['"]:`));
    }
  });
});
