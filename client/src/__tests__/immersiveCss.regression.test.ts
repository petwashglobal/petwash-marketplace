/**
 * Issue #153 PR-IMMERSIVE-CSS — keyboard-safe immersive shell.
 *
 * Driven by `<html data-immersive="true">`, set by App.tsx whenever
 * `isImmersiveRoute(currentPath)` is truthy (canonical helper from
 * PR #187 SHELL-IMMERSIVE).
 *
 * The CEO's screenshot showed the iOS keyboard pushing the bottom nav
 * up behind the autofill bar — that was fixed at the suppression layer
 * by #187. This PR adds the keyboard-aware LAYOUT pieces that #187
 * couldn't:
 *   • 100dvh shell that respects the visualViewport
 *   • safe-area-inset on top + bottom for notched devices
 *   • dedicated `.immersive-scroll` container with `overscroll-behavior:
 *     contain` so the keyboard does not shove the parent scroller
 *   • bottom-pinned `.immersive-cta-bar` for multi-step forms
 *   • iOS auto-zoom prevention (font-size: 16px on inputs)
 *   • last-resort safety-net rule: any leaked nav-shaped fixed-bottom
 *     element gets display:none under data-immersive (#187 already
 *     centralizes suppression at the React level; this is the CSS
 *     belt-and-braces for future strays).
 *
 * Source-pin tests only — no real DOM render. The CSS rules and the
 * App.tsx wiring are pinned by string anchors so future drift fails
 * in CI before it ships.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const ROOT = resolve(__dirname, '..', '..', '..');
const read = (p: string) => readFileSync(resolve(ROOT, p), 'utf8');

describe('PR-IMMERSIVE-CSS — index.css rules', () => {
  const css = read('client/src/index.css');

  it('1. 100dvh shell rule scoped under html[data-immersive="true"]', () => {
    expect(css).toMatch(/html\[data-immersive="true"\][\s\S]{0,400}min-height:\s*100dvh/);
  });

  it('2. .immersive-flow container honours safe-area-inset on all four sides', () => {
    expect(css).toMatch(/\[data-immersive="true"\]\s*\.immersive-flow/);
    expect(css).toMatch(/padding-top:\s*env\(safe-area-inset-top/);
    expect(css).toMatch(/padding-bottom:\s*env\(safe-area-inset-bottom/);
    expect(css).toMatch(/padding-left:\s*env\(safe-area-inset-left/);
    expect(css).toMatch(/padding-right:\s*env\(safe-area-inset-right/);
  });

  it('3. .immersive-scroll uses overscroll-behavior: contain (keyboard-safe)', () => {
    expect(css).toMatch(/\[data-immersive="true"\]\s*\.immersive-scroll[\s\S]{0,400}overscroll-behavior:\s*contain/);
    expect(css).toMatch(/\[data-immersive="true"\]\s*\.immersive-scroll[\s\S]{0,400}-webkit-overflow-scrolling:\s*touch/);
  });

  it('4. .immersive-scroll padding-bottom clears the on-screen keyboard with safe-area-inset', () => {
    const idx = css.indexOf('.immersive-scroll');
    expect(idx).toBeGreaterThan(0);
    const window_ = css.slice(idx, idx + 800);
    // padding-bottom uses max(80px, env(safe-area-inset-bottom)) so
    // bottom CTA + the iOS home indicator both clear correctly.
    expect(window_).toMatch(/padding-bottom:\s*max\(\s*80px\s*,\s*env\(safe-area-inset-bottom/);
  });

  it('5. .immersive-cta-bar is bottom-pinned and lives outside scroll (keyboard-resilient)', () => {
    expect(css).toMatch(/\[data-immersive="true"\]\s*\.immersive-cta-bar/);
    const idx = css.indexOf('.immersive-cta-bar');
    const window_ = css.slice(idx, idx + 600);
    expect(window_).toMatch(/padding-bottom:\s*calc\(\s*\d+px\s*\+\s*env\(safe-area-inset-bottom/);
    // The CTA bar is flex:0 0 auto so it never collapses under the
    // keyboard.
    expect(window_).toMatch(/flex:\s*0\s+0\s+auto/);
  });

  it('6. iOS auto-zoom prevention: inputs/textarea/select get 16px under data-immersive', () => {
    expect(css).toMatch(/\[data-immersive="true"\][\s\S]{0,200}input,[\s\S]{0,200}textarea,[\s\S]{0,200}select[\s\S]{0,300}font-size:\s*16px/);
  });

  it('7. Safety-net: leaked fixed-bottom nav gets display:none under data-immersive', () => {
    // Belt-and-braces for any future global mount that bypasses #187.
    // Scope is intentionally narrow: nav + role="navigation" +
    // [data-floating-stack]. Modals (role="dialog") are intentionally
    // left visible.
    expect(css).toMatch(/html\[data-immersive="true"\]\s+body\s*>\s*nav\[class\*="bottom"\]/);
    expect(css).toMatch(/\[role="navigation"\]\[class\*="bottom"\]/);
    expect(css).toMatch(/\[data-floating-stack\]/);
  });

  it('8. Body min-height: 100dvh is set under data-immersive (Safari iOS keyboard-aware)', () => {
    expect(css).toMatch(/html\[data-immersive="true"\][\s\S]{0,400}body\s*\{[\s\S]{0,300}min-height:\s*100dvh/);
  });
});

describe('PR-IMMERSIVE-CSS — App.tsx wiring', () => {
  const src = read('client/src/App.tsx');

  it('9. App.tsx imports isImmersiveRoute (canonical helper)', () => {
    expect(src).toMatch(/import\s*\{\s*isImmersiveRoute\s*\}\s*from\s*['"]@\/lib\/immersive-routes['"]/);
  });

  it('10. App.tsx writes data-immersive on <html> in a useEffect keyed on isImmersive', () => {
    // The effect must (a) run when isImmersive flips, (b) call
    // setAttribute / removeAttribute on documentElement.
    const idx = src.indexOf('PR-IMMERSIVE-CSS');
    expect(idx).toBeGreaterThan(0);
    const window_ = src.slice(idx, idx + 1200);
    expect(window_).toMatch(/document\.documentElement/);
    expect(window_).toMatch(/setAttribute\(\s*['"]data-immersive['"]\s*,\s*['"]true['"]\s*\)/);
    expect(window_).toMatch(/removeAttribute\(\s*['"]data-immersive['"]\s*\)/);
    expect(window_).toMatch(/\[\s*isImmersive\s*\]/); // dependency array
  });

  it('11. Effect has cleanup that clears data-immersive (no leaked attribute)', () => {
    const idx = src.indexOf('PR-IMMERSIVE-CSS');
    const window_ = src.slice(idx, idx + 1200);
    // Cleanup function returns and calls removeAttribute conditionally
    // on isImmersive (so we only clear what we set).
    expect(window_).toMatch(/return\s*\(\)\s*=>/);
    // There should be at least 2 removeAttribute calls (else-branch + cleanup)
    const removes = window_.match(/removeAttribute/g) || [];
    expect(removes.length).toBeGreaterThanOrEqual(2);
  });

  it('12. App.tsx still wraps MobileBottomNav with !isImmersive (#187 boundary preserved)', () => {
    expect(src).toMatch(/\{\s*showMobileNav\s*&&\s*<MobileBottomNav/);
    // showMobileNav must still derive from !isImmersive so the React-
    // level suppression doesn't drift away from the CSS-level safety
    // net.
    expect(src).toMatch(/const\s+showMobileNav\s*=\s*!isImmersive/);
  });
});

describe('PR-IMMERSIVE-CSS — coexistence with PR #187 boundary', () => {
  const css = read('client/src/index.css');
  const app = read('client/src/App.tsx');

  it('13. data-auth-page colour-scheme rule preserved (legacy auth pages still light-mode)', () => {
    // Pre-existing rule from index.css:914-922; PR-IMMERSIVE-CSS must
    // not delete or shadow it.
    expect(css).toMatch(/\[data-auth-page="true"\]\s*\{[\s\S]{0,200}color-scheme:\s*light/);
  });

  it('14. immersive-routes helper is still imported alongside sticky-account-paths', () => {
    expect(app).toMatch(/from\s*['"]@\/lib\/immersive-routes['"]/);
    expect(app).toMatch(/from\s*['"]@\/lib\/sticky-account-paths['"]/);
  });

  it('15. No display:none rule under data-immersive targets role="dialog"', () => {
    // Sanity: KYC + auth modals MUST stay visible/usable on immersive
    // routes (consent prompts, document pickers, MFA challenges).
    // We extract every `{ ... display: none ... }` block whose
    // selectors include `[data-immersive="true"]`, then assert no
    // such block names role="dialog" in its selector list.
    //
    // This survives the doc-comment containing the literal text
    // (`role="dialog"` appears in our prose explaining why we DO NOT
    // target dialogs) — we only inspect actual selector fragments.
    const ruleRegex = /([^\{\}\/]*\[data-immersive="true"\][^\{]*)\{([^\}]*)\}/g;
    let m: RegExpExecArray | null;
    while ((m = ruleRegex.exec(css)) !== null) {
      const selector = m[1];
      const body = m[2];
      if (/display\s*:\s*none/i.test(body)) {
        expect(selector).not.toMatch(/role="dialog"/);
      }
    }
  });
});
