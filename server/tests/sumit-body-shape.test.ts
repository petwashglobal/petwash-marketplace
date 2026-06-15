/**
 * SumitClient.createDocument body must match SUMIT's real (OfficeGuy) API.
 *
 * Verified 2026-06 against the OfficeGuy/SUMIT swagger (ballasandballas/office_guy_api):
 *   POST /api/accounting/documents/create
 *   { Credentials, Details: { Customer, Type, ... }, Items, Payments, VATIncluded }
 * `Details.Type` is a STRING enum ("Invoice" = חשבונית מס, "InvoiceAndReceipt",
 * "Receipt", "CreditInvoice", …) and Customer lives INSIDE Details.
 *
 * The old code sent a flat root with `DocumentType: 1` (integer) and Customer at
 * the root — structurally wrong, would have been rejected by SUMIT. This guard
 * pins the corrected shape so it can't regress.
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

const src = fs.readFileSync(
  path.resolve(__dirname, '..', 'services', 'SumitClient.ts'),
  'utf8',
);

describe('SumitClient.createDocument — verified SUMIT body shape', () => {
  it('does NOT send the old flat integer DocumentType', () => {
    expect(src).not.toMatch(/DocumentType:\s*1/);
  });

  it('wraps Customer + a STRING Type inside Details', () => {
    expect(src).toMatch(/Details:\s*\{/);
    expect(src).toMatch(/Type:\s*'Invoice'/);
    // Customer is nested under Details (appears after the Details: { opener).
    const detailsIdx = src.indexOf('Details: {');
    const customerIdx = src.indexOf('Customer: {', detailsIdx);
    const itemsIdx = src.indexOf('Items: [');
    expect(detailsIdx).toBeGreaterThan(-1);
    expect(customerIdx).toBeGreaterThan(detailsIdx);
    expect(customerIdx).toBeLessThan(itemsIdx); // Customer inside Details, before Items
  });

  it('keeps Credentials + Items and sets VATIncluded', () => {
    expect(src).toMatch(/Credentials:\s*\{/);
    expect(src).toMatch(/Items:\s*\[/);
    expect(src).toMatch(/VATIncluded:\s*false/);
  });
});
