/**
 * Premium platform cards — mobile no-overflow regression pin (2026-07-10).
 *
 * CEO on iPhone: the Smart Hub & Pet Sitter poster cards were CROPPED on the
 * right (4th feature / logo cut off) — but fine on other devices. The source
 * .webp assets are complete (verified), so it's a DISPLAY overflow: the card
 * column was sized `w-[min(92%,1560px)]` — container-relative `92%`. On iOS
 * Safari the global `body{overflow-x:hidden}` guard leaks, the page inflates,
 * and `92%` then resolves to MORE than the screen, cropping the poster's right
 * edge. Fix: anchor the column to the VIEWPORT (`92vw`, immune to inflation) +
 * `max-w-full` + an `overflow-x-clip` belt on the section.
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

const SRC = fs.readFileSync(
  path.resolve(__dirname, '..', 'PremiumPlatformGrid.tsx'),
  'utf8',
);

describe('PremiumPlatformGrid mobile overflow (2026-07-10)', () => {
  it('card column is viewport-anchored (92vw), not the inflatable 92%', () => {
    expect(SRC).toMatch(/w-\[min\(92vw,1560px\)\]/);
    expect(SRC).not.toMatch(/w-\[min\(92%,1560px\)\]/);
  });

  it('has max-w-full + overflow-x-clip belts against any residual overflow', () => {
    expect(SRC).toMatch(/w-\[min\(92vw,1560px\)\] max-w-full/);
    expect(SRC).toMatch(/<section[\s\S]*?className="overflow-x-clip /);
  });
});
