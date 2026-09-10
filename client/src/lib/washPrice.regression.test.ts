/**
 * One public wash price, one source. /locations (FAQ + JSON-LD) and the
 * /packages empty state must both read lib/washPrice — the site may never
 * state two numbers for the same wash (live QA 2026-09-10: /packages showed
 * no price at all while /locations said ₪55).
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';
import { STANDARD_WASH_PRICE_ILS, STANDARD_WASH_PRICE_LINE } from './washPrice';

const read = (f: string) => fs.readFileSync(path.resolve(__dirname, '..', 'pages', f), 'utf8');

describe('standard wash price — single source', () => {
  it('the line carries the approved number in both languages', () => {
    expect(STANDARD_WASH_PRICE_LINE.he).toContain(`₪${STANDARD_WASH_PRICE_ILS}`);
    expect(STANDARD_WASH_PRICE_LINE.en).toContain(`₪${STANDARD_WASH_PRICE_ILS}`);
  });
  it('/locations FAQ reads it (no hard-coded ₪ price left there)', () => {
    const src = read('Locations.tsx');
    expect(src).toContain("import { STANDARD_WASH_PRICE_LINE } from '@/lib/washPrice';");
    expect(src).toMatch(/aHe: STANDARD_WASH_PRICE_LINE\.he,\s*aEn: STANDARD_WASH_PRICE_LINE\.en,/);
    expect(src).not.toMatch(/wash is ₪\d+/);
  });
  it('/packages empty state shows the single-wash price from the same source', () => {
    const src = read('Packages.tsx');
    expect(src).toContain('data-testid="packages-single-wash-price"');
    expect(src).toContain('STANDARD_WASH_PRICE_LINE.he : STANDARD_WASH_PRICE_LINE.en');
    expect(src).not.toMatch(/₪\s?55/);
  });
});
