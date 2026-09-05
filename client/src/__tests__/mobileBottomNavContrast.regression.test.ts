/**
 * MobileBottomNav colour contrast — WCAG 2.1 AA pin.
 *
 * Added while reviewing the mobile/RTL/a11y lane (2026-09-06). The fix itself
 * is right; what it lacked was a guard, and this is a change that is unusually
 * likely to be undone in good faith.
 *
 * The brand palette is white/black/gold #D4AF37, and gold is a strong house
 * preference — so the obvious "cleanup" is to put the bright brand gold back
 * on the active tab. It cannot go there: NO hue in the brand gold family
 * clears 4.5:1 on white (#D4AF37 itself is 2.10:1). The labels are 10px, so
 * the large-text 3:1 allowance does not apply.
 *
 * The resolution keeps gold as the brand signal WITHOUT failing AA: the
 * AA-compliant glyph is the same hue darkened (GOLD_DEEP), and the bright
 * brand gold survives as a decorative indicator bar adjacent to it.
 *
 * This test recomputes the ratios from the constants in the component source,
 * so changing a hex fails here with the actual number rather than shipping a
 * silent regression.
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

const SRC = fs.readFileSync(
  path.resolve(__dirname, '..', 'components', 'MobileBottomNav.tsx'),
  'utf8',
);

/** WCAG 2.1 relative luminance. */
function luminance(hex: string): number {
  const c = hex.replace('#', '').match(/../g)!
    .map((h) => parseInt(h, 16) / 255)
    .map((v) => (v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/** Read a `const NAME = '#RRGGBB'` out of the component. */
function constHex(name: string): string {
  const m = SRC.match(new RegExp(`const ${name}\\s*=\\s*'(#[0-9A-Fa-f]{6})'`));
  expect(m, `${name} must be declared in MobileBottomNav.tsx`).toBeTruthy();
  return m![1];
}

const WHITE = '#FFFFFF';

describe('MobileBottomNav — the bar paints on white and owes WCAG AA', () => {
  it('the ACTIVE tab colour clears 4.5:1 (10px labels get no large-text allowance)', () => {
    const ratio = contrast(constHex('GOLD_DEEP'), WHITE);
    expect(ratio, `GOLD_DEEP is ${ratio.toFixed(2)}:1 on white`).toBeGreaterThanOrEqual(4.5);
  });

  it('the INACTIVE tab colour clears 4.5:1', () => {
    const ratio = contrast(constHex('GRAY'), WHITE);
    expect(ratio, `GRAY is ${ratio.toFixed(2)}:1 on white`).toBeGreaterThanOrEqual(4.5);
  });

  it('the bright brand gold is NOT used for the glyph — it cannot pass AA', () => {
    // Guard against the well-intentioned "restore the brand gold" edit.
    // #D4AF37 is 2.10:1 and #D9B84C is 1.92:1 on white; both fail 4.5:1 badly.
    const bright = constHex('GOLD_BRIGHT');
    expect(contrast(bright, WHITE)).toBeLessThan(4.5);
    // …so it may only appear as the decorative indicator, never as `color`.
    expect(SRC).toMatch(/const color = isActive \? GOLD_DEEP : GRAY;/);
    expect(SRC).not.toMatch(/const color = isActive \? GOLD_BRIGHT/);
  });

  it('both glyph colours also clear the 3:1 floor icons owe as UI components', () => {
    for (const name of ['GOLD_DEEP', 'GRAY']) {
      expect(contrast(constHex(name), WHITE), name).toBeGreaterThanOrEqual(3);
    }
  });
});
