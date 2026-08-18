/**
 * PR-LOYALTY-BIRTHDAY-COPY-TRUTH — fire-order item 40.
 *
 * Backend birthday programme (server/birthday-coupon.ts + wired into
 * server/services/K9000TransactionService.ts) is exactly ONE thing:
 * a 10% discount coupon, 30-day window around the member's birthday,
 * once per year, on K9000 washes. No double-points, no gift package,
 * no pet reward, no VIP session — none exist in the codebase.
 *
 * The public /loyalty/birthday page listed FIVE benefits. Aligned:
 *   - Row 1 (was "Free Premium Wash") → the real "10% Birthday Discount"
 *     with the actual eligibility rule ("30-day window ... once per year").
 *   - Rows 2..5 kept in place (they read as the CEO's product roadmap)
 *     but marked live:false + description "Planned benefit — coming soon"
 *     with an inline "Coming Soon" tag next to the title. Members are
 *     not promised benefits that don't ship today.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const ROOT = resolve(__dirname, '..', '..');
function read(rel: string): string { return readFileSync(resolve(ROOT, rel), 'utf8'); }

describe('PR-LOYALTY-BIRTHDAY-COPY-TRUTH', () => {
  const src = read('client/src/pages/LoyaltyBirthday.tsx');
  const backend = read('server/birthday-coupon.ts');

  it('A1. row 1 is the real 10% discount + 30-day window + once/year copy', () => {
    expect(src.includes("'10% Birthday Discount'")).toBe(true);
    expect(src.includes("'הנחת יום הולדת 10%'")).toBe(true);
    expect(src.includes("10% off a K9000 wash, valid inside a 30-day window around your birthday, once per year")).toBe(true);
  });

  it('A2. row 1 is flagged live:true (only real benefit)', () => {
    // Find the first row in the rewards array and confirm the live flag.
    const firstRow = src.match(/rewards\s*=\s*\[\s*\{[\s\S]*?\},/)?.[0] || '';
    expect(firstRow.length).toBeGreaterThan(0);
    expect(firstRow.includes('live: true')).toBe(true);
  });

  it('A3. old aspirational copy is gone from the LIVE row', () => {
    // The pre-fix row 1 title was "Free Premium Wash" — not what the
    // backend issues. Must not appear on the live row.
    // Row 1 slice = first array element (up to first comma after closing brace).
    const firstRow = src.match(/rewards\s*=\s*\[\s*\{[\s\S]*?\},/)?.[0] || '';
    expect(firstRow.includes('Free Premium Wash')).toBe(false);
    expect(firstRow.includes('רחיצת פרימיום חינם')).toBe(false);
  });

  it('A4. the misleading "Earn 2x points ... birthday month" claim is gone', () => {
    // The exact phrase item 40 flagged. Must not appear anywhere on
    // this page any more.
    expect(src.includes('Earn 2x points on all washes during your birthday month')).toBe(false);
    expect(src.includes('צברו X2 נקודות על כל הרחיצות בחודש יום ההולדת')).toBe(false);
  });

  it('A5. four aspirational rows are flagged live:false with "Planned ... coming soon" description', () => {
    // Count live:false — must be exactly 4 (out of 5 rows).
    const liveFalseCount = (src.match(/live:\s*false/g) || []).length;
    expect(liveFalseCount).toBe(4);
    // Description must be uniformly "Planned benefit — coming soon" so the
    // customer is not promised a specific benefit that doesn't exist.
    expect(src.includes("'Planned benefit — coming soon.'")).toBe(true);
    expect(src.includes("'הטבה מתוכננת — בהמשך.'")).toBe(true);
  });

  it('A6. render loop shows a "Coming Soon" tag next to non-live titles', () => {
    expect(src.includes('!reward.live &&')).toBe(true);
    expect(src.includes('Coming Soon')).toBe(true);
    expect(src.includes('בקרוב')).toBe(true);
  });

  it('B1. backend authoritative rule is a 10% discount + 30-day window + one-per-year', () => {
    // Pin the source of truth this copy aligns to.
    expect(backend.includes('10% discount')).toBe(true);
    expect(backend.includes('30-day')).toBe(true);
    expect(/hasUsedBirthdayCouponThisYear/.test(backend)).toBe(true);
  });
});
