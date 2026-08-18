/**
 * PR-EGIFT-NO-ACCOUNT-HONEST — fire-order item 21.
 *
 * "No account required" was true only for the PURCHASE step (guest
 * checkout in server/routes/egift-guest.ts). The recipient still
 * needs an account to view wallet balance. Scoped the trust markers
 * to "No account to buy" so the claim matches the action.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const ROOT = resolve(__dirname, '..', '..');
const EGIFT = 'client/src/pages/EGift.tsx';

describe('PR-EGIFT-NO-ACCOUNT-HONEST', () => {
  const src = readFileSync(resolve(ROOT, EGIFT), 'utf8');

  it('A1. noAccountRequired trust marker scoped to "buy" in all 6 locales', () => {
    const block = src.match(/noAccountRequired\s*:\s*\{[\s\S]*?\}/)?.[0] || '';
    expect(block.includes("en: 'No account to buy'")).toBe(true);
    expect(block.includes("he: 'רכישה ללא חשבון'")).toBe(true);
    expect(block.includes("ar: 'الشراء بدون حساب'")).toBe(true);
    expect(block.includes("ru: 'Покупка без аккаунта'")).toBe(true);
    expect(block.includes("fr: 'Achat sans compte'")).toBe(true);
    expect(block.includes("es: 'Compra sin cuenta'")).toBe(true);
    // Grep-guard the pre-fix over-promise out of this block.
    expect(block.includes("'No Account Required'")).toBe(false);
    expect(block.includes("'ללא צורך בחשבון'")).toBe(false);
  });

  it('A2. secureCheckout trust marker scoped the same way', () => {
    const block = src.match(/secureCheckout\s*:\s*\{[\s\S]*?\}/)?.[0] || '';
    expect(block.includes('No account to buy')).toBe(true);
    expect(block.includes('רכישה ללא חשבון')).toBe(true);
    expect(block.includes('No account required')).toBe(false);
    expect(block.includes('ללא צורך בחשבון')).toBe(false);
  });
});
