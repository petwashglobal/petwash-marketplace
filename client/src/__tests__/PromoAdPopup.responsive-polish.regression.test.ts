/**
 * Issue #153 PR-WHITE-2 — Luxury responsive polish + 3.5 s auto-dismiss.
 *
 * BEFORE this fix:
 *   PR #176 made the popup shell pure white. AUTO_DISMISS_MS was 12000
 *   (12 s) — too long for a luxury splash. The card entrance was a flat
 *   opacity transition, no scale cue. The image element accepted the
 *   default mobile interactions: text-select halo on iPhone Safari and
 *   the long-press "save image" sheet on Android Chrome.
 *
 * AFTER this fix:
 *   - AUTO_DISMISS_MS = 3500 (3.5 s) — luxury campaign timing.
 *   - Card entrance uses subtle scale (0.97 → 1.0) when full motion
 *     is allowed; reduced-motion users still get pure-opacity (a11y).
 *   - Image element carries `select-none pointer-events-none`, plus
 *     `draggable={false}`, plus `WebkitTouchCallout: 'none'` and
 *     `WebkitUserSelect: 'none'` inline styles so the iPhone callout
 *     and the Android save-image sheet are suppressed cleanly.
 *   - object-contain + bg-white shell preserved (PR #176 contract).
 *
 * Asset spec for the binary swap (committed separately by CEO):
 *   path:        client/public/brand/petwash-smart-hub-2026.PNG
 *   format:      PNG, 8-bit RGB or RGBA
 *   aspect:      portrait (~2:3); 1024 x 1536 minimum, 2048 x 3072 ideal
 *   background:  pure #FFFFFF on every edge pixel
 *   compression: lossless OR near-lossless (sharp Retina rendering)
 *
 * This source-pin test fails if any of the seven guarantees regress.
 */

import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

const SRC = fs.readFileSync(
  path.resolve(__dirname, '..', 'components', 'PromoAdPopup.tsx'),
  'utf8',
);

describe('Issue #153 PR-WHITE-2 — popup luxury responsive polish', () => {
  it('AUTO_DISMISS_MS is 3500 (3.5 s premium splash), not the prior 12 s', () => {
    expect(SRC).toMatch(/const\s+AUTO_DISMISS_MS\s*=\s*3500\b/);
    expect(SRC).not.toMatch(/const\s+AUTO_DISMISS_MS\s*=\s*12000\b/);
  });

  it('full-motion card variants include subtle scale (0.97 → 1.0)', () => {
    // Anchor on the cardVariants ternary so the assertion targets the
    // right path. The non-reduced-motion branch must include the scale
    // tween. The reduced-motion branch must remain pure-opacity.
    expect(SRC).toMatch(
      /cardVariants\s*=\s*prefersReducedMotion[\s\S]{0,800}initial:\s*\{\s*opacity:\s*0,\s*scale:\s*0\.97\s*\}/,
    );
    expect(SRC).toMatch(/animate:\s*\{\s*opacity:\s*1,\s*scale:\s*1\s*\}/);
    expect(SRC).toMatch(/exit:\s*\{\s*opacity:\s*0,\s*scale:\s*0\.99\s*\}/);
  });

  it('reduced-motion path stays pure-opacity for both backdrop and card (a11y)', () => {
    // The first branch of cardVariants (when prefersReducedMotion is true)
    // must NOT introduce scale. Pin the shape.
    const cardBlock =
      SRC.match(/cardVariants\s*=\s*prefersReducedMotion\s*\?\s*\{[\s\S]{0,200}\}/)?.[0] ?? '';
    expect(cardBlock).toMatch(
      /\?\s*\{\s*initial:\s*\{\s*opacity:\s*0\s*\},\s*animate:\s*\{\s*opacity:\s*1\s*\},\s*exit:\s*\{\s*opacity:\s*0\s*\}\s*\}/,
    );
    // backdropVariants must remain pure-opacity always (no scale on the
    // shell — the artwork "rises" but the white field does not zoom).
    expect(SRC).toMatch(
      /backdropVariants\s*=\s*\{\s*initial:\s*\{\s*opacity:\s*0\s*\},\s*animate:\s*\{\s*opacity:\s*1\s*\},\s*exit:\s*\{\s*opacity:\s*0\s*\}\s*\}/,
    );
  });

  it('image element carries premium mobile interaction guards', () => {
    // Pin: select-none + pointer-events-none on the img class string,
    // draggable={false}, and the inline iOS/Safari touch-callout
    // suppressions. We walk the file by anchor index rather than match
    // a single regex window (the comment block inside the <img/> can be
    // long; an index walk is more robust).
    const altIdx = SRC.indexOf('alt="Pet Wash™ Smart Hub"');
    expect(altIdx).toBeGreaterThan(0);
    const tagStart = SRC.lastIndexOf('<img', altIdx);
    expect(tagStart).toBeGreaterThan(0);
    // First standalone "/>" (or "} />") after the alt attribute closes the tag.
    const tagEnd = SRC.indexOf('/>', altIdx);
    expect(tagEnd).toBeGreaterThan(altIdx);
    const imgTag = SRC.slice(tagStart, tagEnd + 2);
    expect(imgTag).toMatch(/object-contain/);
    expect(imgTag).toMatch(/select-none/);
    expect(imgTag).toMatch(/pointer-events-none/);
    expect(imgTag).toMatch(/draggable=\{false\}/);
    expect(imgTag).toMatch(/WebkitTouchCallout:\s*['"]none['"]/);
    expect(imgTag).toMatch(/WebkitUserSelect:\s*['"]none['"]/);
  });

  it('PR #176 pure-white shell contract preserved (no regression)', () => {
    // Outer modal backdrop, click-catcher, card, and image panel must
    // all still be bg-white. PR #176 turned them white; PR-WHITE-2 must
    // not silently revert any layer.
    expect(SRC).toMatch(
      /className="fixed inset-0 z-\[9999\][\s\S]{0,200}bg-white/,
    );
    expect(SRC).toMatch(
      /<div\s+className="absolute inset-0 bg-white"\s+onClick=\{\(\)\s*=>\s*handleClose\('user'\)\}/,
    );
    expect(SRC).toMatch(
      /className="relative w-full h-full overflow-hidden bg-white"/,
    );
    expect(SRC).toMatch(
      /<div className="absolute inset-0 bg-white">/,
    );
    expect(SRC).not.toMatch(/<div\s+className="absolute inset-0 bg-black"/);
  });

  it('PR #176 close-button dark-on-white contrast contract preserved (no regression)', () => {
    const idx = SRC.indexOf('data-testid="button-close-promo"');
    expect(idx).toBeGreaterThan(0);
    const buttonStart = SRC.lastIndexOf('<button', idx);
    expect(buttonStart).toBeGreaterThan(0);
    const openingTag = SRC.slice(buttonStart, SRC.indexOf('>', idx));
    expect(openingTag).toMatch(/text-black/);
    expect(openingTag).toMatch(/bg-white\/90/);
    expect(openingTag).toMatch(/border-black\/10/);
  });

  it('business logic preserved: 24 h suppression, pause-on-hover, safety guard, image path', () => {
    // PR #176 + PR-WHITE-2 must not weaken any of these. They are NOT
    // in scope for this PR. Anchor the constants & references so a
    // future "polish" PR cannot drop them quietly.
    expect(SRC).toMatch(/SUPPRESS_DURATION_MS\s*=\s*24\s*\*\s*60\s*\*\s*60\s*\*\s*1000/);
    expect(SRC).toMatch(/setIsHovered\(true\)/);
    expect(SRC).toMatch(/isPublicSafePromoImage/);
    // Asset path unchanged (Linux is case-sensitive; .PNG must stay).
    expect(SRC).toMatch(/imageUrl:\s*['"]\/brand\/petwash-smart-hub-2026\.PNG['"]/);
  });
});
