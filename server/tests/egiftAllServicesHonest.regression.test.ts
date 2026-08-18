/**
 * PR-EGIFT-ALL-SERVICES-HONEST — fire-order item 18.
 *
 * "All Services" / "כל השירותים" was too broad — implied every current
 * AND future PetWash surface accepts the voucher, but PetTrek is
 * coming-soon (PR-EGIFT-COMING-SOON-SERVICES already flagged that
 * service in the picker). "All available services" is bounded, honest,
 * and stays true as new services come online.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const ROOT = resolve(__dirname, '..', '..');
const EGIFT = 'client/src/pages/EGift.tsx';

describe('PR-EGIFT-ALL-SERVICES-HONEST', () => {
  const src = readFileSync(resolve(ROOT, EGIFT), 'utf8');

  it('A1. allServices label says "All available services" in English', () => {
    const block = src.match(/allServices\s*:\s*\{[\s\S]*?\}/)?.[0] || '';
    expect(block.includes("en: 'All available services'")).toBe(true);
    // Grep-guard against the pre-fix over-promise.
    expect(block.includes("en: 'All Services'")).toBe(false);
  });

  it('A2. Hebrew says "כל השירותים הזמינים" (all AVAILABLE services)', () => {
    const block = src.match(/allServices\s*:\s*\{[\s\S]*?\}/)?.[0] || '';
    expect(block.includes("he: 'כל השירותים הזמינים'")).toBe(true);
    // Pin absence of the bare pre-fix Hebrew.
    expect(block.includes("he: 'כל השירותים'")).toBe(false);
  });

  it('A3. platformCredit label matches the same "available" scope', () => {
    // Consistency: the card header text should not promise "Platform-Wide"
    // while the trust marker below says "available services" — one honest
    // wording throughout.
    const block = src.match(/platformCredit\s*:\s*\{[\s\S]*?\}/)?.[0] || '';
    expect(block.includes("en: 'Credit for available services'")).toBe(true);
    expect(block.includes("he: 'קרדיט לשירותים הזמינים'")).toBe(true);
    // Pin the pre-fix over-promise out.
    expect(block.includes('Platform-Wide')).toBe(false);
    expect(block.includes('לכל הפלטפורמות')).toBe(false);
  });

  it('A4. all 6 locales carry the "available" qualifier (no locale left overselling)', () => {
    const block = src.match(/allServices\s*:\s*\{[\s\S]*?\}/)?.[0] || '';
    // Each locale must include a word that scopes the promise (available /
    // disponibles / متاحة / доступные / זמינים / disponibili).
    expect(block.includes('available')).toBe(true);
    expect(block.includes('disponibles')).toBe(true);
    expect(block.includes('المتاحة')).toBe(true);
    expect(block.includes('доступные')).toBe(true);
    expect(block.includes('זמינים')).toBe(true);
  });
});
