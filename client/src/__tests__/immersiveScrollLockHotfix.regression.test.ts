/**
 * Issue #153 PR-IMMERSIVE-HOTFIX — iPhone Safari scroll-lock regression.
 *
 * P0 production bug (CEO screenshot 2026-05-08, 07:27 IST):
 *   /sign-in?redirect=%2Fprovider-onboarding froze on iPhone Safari —
 *   page trapped mid-render, body could not scroll.
 *
 * Root cause: PR #190 (PR-IMMERSIVE-CSS) added
 *
 *     html[data-immersive="true"],
 *     html[data-immersive="true"] body {
 *       overflow: hidden;
 *     }
 *
 * The intent was that every immersive page would adopt the
 * `.immersive-flow` / `.immersive-scroll` containers and scroll
 * inside them instead of on body. Audit at hotfix time confirmed
 * that ZERO pages currently use those classes
 * (`grep -rn 'immersive-flow\|immersive-scroll' client/src` →
 *   no matches in any *.tsx). Result: body locked, no internal
 * scroller, page frozen.
 *
 * This regression suite asserts the dangerous rule is gone and
 * cannot return without breaking a CI pin.
 *
 * Out of scope (intentional preservation):
 *   - The dormant `.immersive-flow` / `.immersive-scroll` /
 *     `.immersive-cta-bar` rules remain (they're scoped to those
 *     classes; no page uses them today so they're inert).
 *   - iOS auto-zoom prevention (`input { font-size: 16px }` under
 *     [data-immersive]) remains — it was a real bug fix.
 *   - Safety-net `display: none` on leaked nav under data-immersive
 *     remains — that's the #187 belt-and-braces.
 *
 * Pure source-pin tests on the merged CSS file. No DOM render.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const ROOT = resolve(__dirname, '..', '..', '..');
const css = readFileSync(resolve(ROOT, 'client/src/index.css'), 'utf8');

describe('PR-IMMERSIVE-HOTFIX — html/body scroll-lock REMOVED under data-immersive', () => {
  /**
   * Helper: extract every CSS rule that targets `html[data-immersive="true"]`
   * (with or without a `body` descendant). Returns the body of each rule
   * after stripping comments. We then assert NONE of them contain
   * `overflow: hidden`, `position: fixed`, or `touch-action: none` —
   * the three iOS Safari scroll-lock surfaces.
   */
  function extractDocumentLevelImmersiveRules(): string[] {
    const noComments = css.replace(/\/\*[\s\S]*?\*\//g, '');
    const ruleRegex = /(html\[data-immersive="true"\][^\{]*)\{([^\}]*)\}/g;
    const bodies: string[] = [];
    let m: RegExpExecArray | null;
    while ((m = ruleRegex.exec(noComments)) !== null) {
      bodies.push(m[2]);
    }
    return bodies;
  }

  it('1. NO html[data-immersive] rule sets overflow: hidden', () => {
    const bodies = extractDocumentLevelImmersiveRules();
    for (const body of bodies) {
      expect(body).not.toMatch(/overflow\s*:\s*hidden/i);
      expect(body).not.toMatch(/overflow-y\s*:\s*hidden/i);
    }
  });

  it('2. NO html[data-immersive] rule sets position: fixed (would lock viewport)', () => {
    const bodies = extractDocumentLevelImmersiveRules();
    for (const body of bodies) {
      expect(body).not.toMatch(/position\s*:\s*fixed/i);
    }
  });

  it('3. NO html[data-immersive] rule sets touch-action: none (would block scroll on iOS)', () => {
    const bodies = extractDocumentLevelImmersiveRules();
    for (const body of bodies) {
      expect(body).not.toMatch(/touch-action\s*:\s*none/i);
    }
  });

  it('4. The retirement comment documents the iPhone Safari freeze + WHY the rule was removed', () => {
    expect(css).toMatch(/PR-IMMERSIVE-HOTFIX/);
    expect(css).toMatch(/iPhone Safari/i);
    expect(css).toMatch(/no page adopted|NO PAGE adopted|none do/i);
  });
});

describe('PR-IMMERSIVE-HOTFIX — preserved-on-purpose rules still present', () => {
  it('5. Dormant .immersive-flow container rule preserved (still inert until adopted)', () => {
    expect(css).toMatch(/\[data-immersive="true"\]\s*\.immersive-flow/);
  });

  it('6. Dormant .immersive-scroll container rule preserved', () => {
    expect(css).toMatch(/\[data-immersive="true"\]\s*\.immersive-scroll/);
    // overflow-y: auto INSIDE the .immersive-scroll container is
    // intentional — that's the future scroller. It only applies if
    // a page adopts the class, so it cannot freeze the document.
    // Strip comments first so we anchor on the real CSS rule, not
    // the retirement comment that mentions `.immersive-scroll` by name.
    const noComments = css.replace(/\/\*[\s\S]*?\*\//g, '');
    const idx = noComments.indexOf('[data-immersive="true"] .immersive-scroll');
    expect(idx).toBeGreaterThan(0);
    const window_ = noComments.slice(idx, idx + 600);
    expect(window_).toMatch(/overflow-y\s*:\s*auto/);
  });

  it('7. iOS auto-zoom prevention (font-size: 16px on inputs) preserved', () => {
    expect(css).toMatch(/\[data-immersive="true"\][\s\S]{0,200}input,[\s\S]{0,200}textarea,[\s\S]{0,200}select[\s\S]{0,300}font-size:\s*16px/);
  });

  it('8. Safety-net display:none on leaked fixed-bottom nav preserved (#187 contract)', () => {
    expect(css).toMatch(/html\[data-immersive="true"\]\s+body\s*>\s*nav\[class\*="bottom"\]/);
    expect(css).toMatch(/\[role="navigation"\]\[class\*="bottom"\]/);
    expect(css).toMatch(/\[data-floating-stack\]/);
  });
});

describe('PR-IMMERSIVE-HOTFIX — body scroll cannot be locked from any global rule', () => {
  it('9. NO global rule sets overflow: hidden on body (excluding the legacy app-shell context)', () => {
    // We allow `overflow: hidden` on body INSIDE a deep descendant
    // selector (e.g. `.modal body { ... }` is fine — modals lock
    // scroll on themselves). The dangerous pattern is a TOP-LEVEL
    // rule that targets `body` as a primary selector.
    const noComments = css.replace(/\/\*[\s\S]*?\*\//g, '');
    // Strip rule bodies first — we only care about selectors
    // followed by `{ ... overflow: hidden ... }`.
    const offending = noComments.match(
      /(^|\}|\s)body\s*\{[^\}]*overflow\s*:\s*hidden[^\}]*\}/g,
    ) || [];
    expect(offending).toEqual([]);
  });

  it('10. NO global rule sets overflow: hidden on html (excluding deep nested contexts)', () => {
    const noComments = css.replace(/\/\*[\s\S]*?\*\//g, '');
    // Match TOP-LEVEL `html { ... overflow: hidden ... }` (and
    // `html[...] { ... overflow: hidden ... }` variants). Allow
    // nested selectors like `.foo html { ... }` because they only
    // apply within an explicit container.
    const ruleRegex = /(?:^|\})\s*(html(?:\[[^\]]*\])?(?:\s*,\s*html(?:\[[^\]]*\])?)*)\s*\{([^\}]*)\}/g;
    let m: RegExpExecArray | null;
    while ((m = ruleRegex.exec(noComments)) !== null) {
      const body = m[2];
      expect(body).not.toMatch(/overflow\s*:\s*hidden/i);
    }
  });
});
