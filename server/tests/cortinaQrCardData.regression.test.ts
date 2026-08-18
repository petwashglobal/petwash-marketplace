/**
 * Cortina redeem — read the member QR from the correct Nayax field (2026-08-12).
 *
 * Verified via the Nayax dev-portal connector: in Cortina External Prepaid, when
 * the DOT reader scans the member's app QR, the scanned content arrives as
 * CardData.CardNumber with CardData.EntryMode === "QR"
 * (/reference/cortina/cortina-prepaid/cortina-prepaid-sale). Our parser previously
 * read `code` only from flat b.Code/b.qr/b.Data guesses that never appear in the
 * real payload — so `code` resolved to '' and EVERY redemption declined (code 2).
 * This pins the CardData.CardNumber read (EntryMode-guarded) so it can't regress.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const src = readFileSync(resolve(__dirname, '..', 'routes', 'nayax-cortina.ts'), 'utf8');

describe('Cortina parseCortinaRequest reads the QR from CardData.CardNumber', () => {
  it('extracts CardData and guards on EntryMode === "QR"', () => {
    expect(src).toMatch(/cardData\s*=\s*b\.CardData/);
    expect(src).toMatch(/entryMode\s*===\s*'QR'/);
    expect(src).toMatch(/cardData\.CardNumber/);
  });

  it('the code field prefers the QR card number over the old flat guesses', () => {
    // The `code:` assignment must reference cardData.CardNumber BEFORE the legacy
    // b.Code/b.qr fallbacks.
    const codeLine = src.split('\n').find((l) => /code:\s*String\(/.test(l)) || '';
    const idxCard = codeLine.indexOf('cardData.CardNumber');
    const idxLegacy = codeLine.indexOf('b.Code');
    expect(idxCard).toBeGreaterThanOrEqual(0);
    expect(idxLegacy).toBeGreaterThan(idxCard); // CardData comes first
  });
});
