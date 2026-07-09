/**
 * SUMIT is the issuer of record for EVERY sale — regression pin (2026-07-09).
 *
 * CEO: "all templates at SUMIT must be automatic — live, real." The SUMIT client
 * is built + proven (real doc #10000 issued 07-05) and the creds are present
 * (SUMIT_API_KEY + SUMIT_COMPANY_ID set). The only thing limiting it was a gate
 * that called SUMIT ONLY above the ₪5k SHAAM threshold, so normal ₪55 washes /
 * shop / eGift never got a SUMIT document. Both the receipt path and the credit-
 * note (זיכוי) path now call SUMIT whenever the account isWired(), so every sale
 * and every refund is SUMIT-issued and ITA-reported.
 *
 * Still dormant until the account is switched on: isWired() requires
 * SUMIT_ENABLED=true AND api key / company id / webhook secret — so this is a
 * no-op (no HTTP) until go-live.
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

const SRC = fs.readFileSync(
  path.resolve(__dirname, '..', 'services', 'IsraeliDigitalReceiptService.ts'),
  'utf8',
);

describe('SUMIT issues on every sale, not just >₪5k (2026-07-09)', () => {
  it('the receipt + credit gates no longer require shaamRequired', () => {
    expect(SRC).not.toMatch(/shaamRequired && sumitClient\.isWired\(\)/);
    expect(SRC).not.toMatch(/sumitClient\.isWired\(\) && shaamRequired/);
  });

  it('both paths call SUMIT purely on isWired()', () => {
    const matches = SRC.match(/if \(sumitClient\.isWired\(\)\) \{/g) || [];
    expect(matches.length).toBeGreaterThanOrEqual(2);
  });

  it('documents the go-live single-document check', () => {
    expect(SRC).toMatch(/GO-LIVE CHECK/);
    expect(SRC).toMatch(/issuer of record/i);
  });
});
