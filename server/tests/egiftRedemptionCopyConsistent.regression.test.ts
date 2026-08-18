/**
 * PR-EGIFT-REDEMPTION-COPY-CONSISTENT — fire-order item 19.
 *
 * /egift header said "Redeemable at any wash station or online" but the
 * service picker below (usableAt) lists K9000/Sitter/Walker/Academy/
 * Nayax. "Wash station or app" was NARROWER than the picker — a public
 * contradiction. Aligned to the picker's honest scope.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const ROOT = resolve(__dirname, '..', '..');
const EGIFT = 'client/src/pages/EGift.tsx';

describe('PR-EGIFT-REDEMPTION-COPY-CONSISTENT', () => {
  const src = readFileSync(resolve(ROOT, EGIFT), 'utf8');

  it('A1. header no longer says "wash station or online" (was narrower than the picker)', () => {
    expect(src.includes('Redeemable at any wash station or online')).toBe(false);
    expect(src.includes('בתחנת שטיפה או באפליקציה')).toBe(false);
  });

  it('A2. header aligned to the service picker below ("services shown below")', () => {
    expect(src.includes('Redeemable across the available PetWash services shown below')).toBe(true);
    expect(src.includes('בשירותי PetWash הזמינים המוצגים למטה')).toBe(true);
  });
});
