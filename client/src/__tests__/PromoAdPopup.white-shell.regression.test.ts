/**
 * Issue #153 PR-WHITE-1 — Pure-white luxury popup shell regression pin.
 *
 * BEFORE this fix:
 *   `client/src/components/PromoAdPopup.tsx` framed the brand artwork in
 *   FOUR layered `bg-black` surfaces (backdrop, click-catcher, card,
 *   image panel) and used `object-cover` on the <img>. On iPhone Safari
 *   the dynamic toolbar + the dark shell + the cover-crop combined to
 *   read as a dirty grey letterbox around the white luxury creative.
 *   The close button was a dark-on-glass treatment designed for a black
 *   frame, which would invert badly when the shell turned white.
 *
 * AFTER this fix:
 *   - Backdrop, click-catcher, card, and PosterTemplate image panel all
 *     use `bg-white` so any letterbox/pillarbox space is pure #FFFFFF.
 *   - <img> uses `object-contain` so the artwork is shown in full
 *     instead of cropped into its own white margin.
 *   - Close button switches to dark-on-white glass (text-black,
 *     bg-white/90, border-black/10) so the X stays high-contrast on the
 *     new white shell.
 *
 * This source-pin test fails if any of the seven guarantees regress.
 *
 * Out of scope (NOT changed in this PR):
 *   - Popup timing / show-once / 24 h suppression / pause-on-hover
 *   - Suppression of the popup on critical routes
 *   - Image asset itself (asset-side pixel audit is separate)
 *   - SplitRewards / SplitApp / MembershipTiers / Fullscreen templates
 *   - The branded gradient fallback (only fires if the image is missing)
 */

import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

const SRC = fs.readFileSync(
  path.resolve(__dirname, '..', 'components', 'PromoAdPopup.tsx'),
  'utf8',
);

describe('Issue #153 PR-WHITE-1 — pure-white popup shell', () => {
  it('outer modal backdrop uses bg-white (not bg-black)', () => {
    // Anchor on the data-testid so the assertion targets the exact
    // outer modal container even if other class strings shift.
    const block =
      SRC.match(
        /className="fixed inset-0 z-\[9999\][\s\S]{0,200}data-testid="promo-ad-popup"/,
      )?.[0] ?? '';
    expect(block).toMatch(/bg-white/);
    expect(block).not.toMatch(/bg-black/);
  });

  it('click-catcher overlay uses bg-white (not bg-black)', () => {
    // The absolute-inset overlay that handles the dismiss-on-tap gesture.
    expect(SRC).toMatch(
      /<div\s+className="absolute inset-0 bg-white"\s+onClick=\{\(\)\s*=>\s*handleClose\('user'\)\}/,
    );
    expect(SRC).not.toMatch(
      /<div\s+className="absolute inset-0 bg-black"\s+onClick/,
    );
  });

  it('inner card surface uses bg-white (not bg-black)', () => {
    expect(SRC).toMatch(
      /className="relative w-full h-full overflow-hidden bg-white"/,
    );
    expect(SRC).not.toMatch(
      /className="relative w-full h-full overflow-hidden bg-black"/,
    );
  });

  it('PosterTemplate image panel uses bg-white (not bg-black)', () => {
    expect(SRC).toMatch(
      /<div className="absolute inset-0 bg-white">\s*\n\s*<img/,
    );
    expect(SRC).not.toMatch(
      /<div className="absolute inset-0 bg-black">\s*\n\s*<img/,
    );
  });

  it('image uses object-contain (not object-cover) so brand artwork is never cropped', () => {
    // The <img> tag inside PosterTemplate must be object-contain. We
    // anchor the assertion on the alt text so we hit the right <img>.
    const imgTag =
      SRC.match(/<img\s+[\s\S]{0,400}alt="Pet Wash™ Smart Hub"[\s\S]{0,400}\/>/)?.[0] ?? '';
    expect(imgTag).toMatch(/object-contain/);
    expect(imgTag).not.toMatch(/object-cover/);
  });

  it('close button uses dark-on-white glass treatment for contrast on the new shell', () => {
    // Pin the critical className fragments on the button containing the
    // close test-id. Anchor: opening <button on a line, run forward until
    // the data-testid we care about, then check the className that ran by.
    const idx = SRC.indexOf('data-testid="button-close-promo"');
    expect(idx).toBeGreaterThan(0);
    // Walk back to the nearest preceding "<button" to capture the full opening tag.
    const buttonStart = SRC.lastIndexOf('<button', idx);
    expect(buttonStart).toBeGreaterThan(0);
    // Capture the opening tag up to the >.
    const openingTag = SRC.slice(buttonStart, SRC.indexOf('>', idx));
    expect(openingTag).toMatch(/text-black/);
    expect(openingTag).toMatch(/bg-white\/90/);
    expect(openingTag).toMatch(/border-black\/10/);
    // Make sure the prior dark treatment is gone:
    expect(openingTag).not.toMatch(/text-white\s+bg-black\/45/);
    expect(openingTag).not.toMatch(/border-white\/20/);
  });

  it('popup business logic preserved (timing, suppression, pause-on-hover, close button)', () => {
    // Regression guards: a future "white-luxury polish" PR must not
    // accidentally weaken the show-once, 24 h suppression, or pause-on-
    // hover semantics that PR-WHITE-1 explicitly does not touch.
    expect(SRC).toMatch(/AUTO_DISMISS_MS\s*=\s*12000/);
    expect(SRC).toMatch(/SUPPRESS_DURATION_MS\s*=\s*24\s*\*\s*60\s*\*\s*60\s*\*\s*1000/);
    expect(SRC).toMatch(/setIsHovered\(true\)/);
    expect(SRC).toMatch(/data-testid="button-close-promo"/);
    // Public-image safety guard preserved (block backend/dev screenshots).
    expect(SRC).toMatch(/isPublicSafePromoImage/);
  });
});
