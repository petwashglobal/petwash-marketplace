/**
 * Stored-value SUMIT Receipt is payment-only (no VAT) — regression pin (2026-07-09).
 *
 * VERIFIED LIVE against SUMIT: a Type=Receipt with Payments only (no items) →
 * Status 0, zero VAT, separate number series (doc #30000). So wallet top-ups and
 * eGift purchases issue a קבלה that records the payment with NO VAT (tax deferred
 * to redemption, CPA order #5), while every other document type keeps the taxable
 * line so SUMIT adds 18%.
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

const SRC = fs.readFileSync(path.resolve(__dirname, '..', 'services', 'SumitClient.ts'), 'utf8');

describe('SUMIT stored-value Receipt carries no VAT (2026-07-09)', () => {
  it('omits VAT-bearing Items when the document type is Receipt', () => {
    expect(SRC).toMatch(/if \(\(input\.documentType \|\| 'InvoiceAndReceipt'\) !== 'Receipt'\) \{/);
    // Rewritten 2026-09-06. The pin used to require the literal `body.Items = [{`.
    // That went red once the taxable line became a ternary (stable-catalogue item
    // vs. fallback item, added for the K9000 rail) — `[` is now followed by
    // `input.item ? …`, not `{`. The BEHAVIOUR it guards never changed, so the pin
    // was wrong, not the code. It now asserts the contract: inside the non-Receipt
    // branch a taxable line is assigned, priced BEFORE VAT, with VATIncluded false
    // so SUMIT adds the 18% itself.
    const branch = SRC.slice(
      SRC.indexOf("if ((input.documentType || 'InvoiceAndReceipt') !== 'Receipt') {"),
    ).slice(0, 1600);
    expect(branch).toMatch(/body\.Items = \[/);
    expect(branch).toMatch(/UnitPrice: input\.amountBeforeVat/);
    expect(SRC).toMatch(/body\.VATIncluded = false/);
  });

  it('documents the live verification (doc #30000, zero VAT)', () => {
    expect(SRC).toMatch(/VERIFIED LIVE 2026-07-09/);
    expect(SRC).toMatch(/#30000/);
  });
});
