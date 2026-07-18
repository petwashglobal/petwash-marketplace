/**
 * iPhone Safari scroll-lock regression — the JavaScript surface.
 *
 * P0 production bug (CEO, 2026-07-18): petwash.co.il could not be scrolled at
 * all on iPhone Safari. Live DOM inspection showed:
 *
 *     <body style="touch-action: none;">
 *
 * with NO `overflow: hidden` alongside it.
 *
 * Root cause: PromoAdPopup locked background scroll with BOTH
 * `overflow:hidden` and `touch-action:none`, then on cleanup *restored the
 * previously captured values*. Once that captured "previous" value was itself
 * `none` — two locks overlapping, or the effect re-running through its
 * `isHovered` / `handleClose` deps — cleanup faithfully restored `none` and the
 * lock became permanent. Overflow got cleared correctly, which is exactly why
 * the stuck body carried touch-action WITHOUT overflow.
 *
 * `touch-action: none` disables every touch gesture, scrolling included, so a
 * leak of it bricks the entire site on mobile. `overflow: hidden` alone is
 * sufficient to lock background scroll behind a modal.
 *
 * Sibling pin: immersiveScrollLockHotfix.regression.test.ts covers the CSS
 * surface of this same class of bug (#153). This one covers the JS surface.
 *
 * Pure source-pin test. No DOM render.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'fs';
import { resolve, join } from 'path';

const ROOT = resolve(__dirname, '..', '..', '..');
const SRC = resolve(ROOT, 'client/src');

/** Every .ts/.tsx file under client/src, excluding this test itself. */
function sourceFiles(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry === 'dist') continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      sourceFiles(full, acc);
    } else if (/\.tsx?$/.test(entry) && !full.includes('bodyTouchActionScrollLock')) {
      acc.push(full);
    }
  }
  return acc;
}

describe('body scroll-lock — touch-action:none must never be set on <body>', () => {
  it('no source file assigns document.body.style.touchAction = "none"', () => {
    const offenders: string[] = [];

    for (const file of sourceFiles(SRC)) {
      const src = readFileSync(file, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
      // Matches: document.body.style.touchAction = 'none'  (any quote style/spacing)
      const assign = /document\s*\.\s*body\s*\.\s*style\s*\.\s*touchAction\s*=\s*['"`]none['"`]/;
      // Matches: body.style.setProperty('touch-action', 'none')
      const setProp = /body\s*\.\s*style\s*\.\s*setProperty\(\s*['"`]touch-action['"`]\s*,\s*['"`]none['"`]/;
      if (assign.test(src) || setProp.test(src)) {
        offenders.push(file.replace(ROOT + '/', ''));
      }
    }

    expect(
      offenders,
      `touch-action:none on <body> disables ALL touch gestures — if it leaks, the ` +
        `whole site becomes unscrollable on iOS (production incident 2026-07-18). ` +
        `Use overflow:hidden alone to lock background scroll. Offenders: ${offenders.join(', ')}`,
    ).toEqual([]);
  });

  it('PromoAdPopup clears its scroll lock rather than restoring a captured value', () => {
    const src = readFileSync(resolve(SRC, 'components/PromoAdPopup.tsx'), 'utf8');
    // It must not resurrect a saved touch-action value…
    expect(src).not.toMatch(/style\.touchAction\s*=\s*prevTouchAction/);
    // …and its cleanup must clear overflow outright, not restore a possibly-poisoned one.
    expect(src).toMatch(/document\.body\.style\.overflow\s*=\s*''/);
  });
});
