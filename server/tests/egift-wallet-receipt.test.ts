/**
 * eGift + wallet-topup fiscal receipt — regression pin.
 *
 * Fiscal audit 2026-07-05: eGift purchases and wallet top-ups took real money
 * but issued NO חשבונית מס/קבלה (their sibling classes — wash package, single
 * wash, shop — all did). Both now call issueDirectSaleReceipt so a tax receipt
 * is issued to the buyer at point of sale.
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';
import { PETWASH_INCOME_ITEMS } from '@shared/petwashIncomeItems';

const SRC = fs.readFileSync(
  path.resolve(__dirname, '..', 'services', 'PurchaseActivationService.ts'),
  'utf8',
);

describe('eGift + wallet fiscal receipt — audit 2026-07-05', () => {
  it('wallet top-up issues a receipt (PW_WALLET_TOPUP) after crediting', () => {
    // in the ACCOUNT_CREDIT branch, addCredits then issueDirectSaleReceipt
    expect(SRC).toMatch(/productType === 'ACCOUNT_CREDIT'[\s\S]*addCredits\([\s\S]*issueDirectSaleReceipt\(purchase, 'PW_WALLET_TOPUP'\)/);
  });

  it('eGift purchase issues a receipt (PW_GIFT_CARD) to the buyer', () => {
    expect(SRC).toMatch(/issueDirectSaleReceipt\(purchase, 'PW_GIFT_CARD', \{ email: purchaserEmail, name: senderName \}\)/);
  });

  it('the wallet-topup income item exists in the catalog', () => {
    expect(PETWASH_INCOME_ITEMS.PW_WALLET_TOPUP).toBeDefined();
    expect(PETWASH_INCOME_ITEMS.PW_WALLET_TOPUP.module).toBe('wallet');
  });

  it('the direct-sale receipt helper VATs the full amount with no commission (direct PetWash income)', () => {
    expect(SRC).toMatch(/platformFeeAmount: 0,\s*\/\/ direct PetWash sale/);
  });

  it('receipt issuance is non-blocking (never fails the credit/voucher grant)', () => {
    expect(SRC).toMatch(/Direct-sale receipt failed \(non-blocking\)/);
  });
});
