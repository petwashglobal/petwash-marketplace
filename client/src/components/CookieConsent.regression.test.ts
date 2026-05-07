/**
 * Issue #166 — mobile cookie consent regression pin.
 *
 * Real iPhone Safari smoke (issue body) showed:
 *   - Cookie consent panel covered LOGIN area underneath
 *   - WhatsApp / accessibility / AI floating buttons OVERLAPPED the
 *     consent panel's Accept All / Reject / Manage buttons
 *   - No max-height — long copy could push action buttons offscreen
 *   - No safe-area-inset-bottom — panel could clash with iPhone home
 *     indicator
 *   - Buttons did not stack on narrow widths
 *
 * Fix this PR ships:
 *   1. CookieConsent z-index bumped from `z-40` to `z-[9100]` so it
 *      wins over FloatingStack (z-9050) by the CSS spec alone.
 *   2. CookieConsent useEffect sets
 *      `document.body[data-cookie-consent-active="true"]` while
 *      mounted; floating-stack.css hides FloatingStack while that
 *      attribute is present (defense-in-depth).
 *   3. Inner panel gets `max-height: calc(100dvh - 4rem - safe-area)`
 *      and `overflow-y: auto` so action buttons are always reachable.
 *   4. Outer container gets `paddingBottom: env(safe-area-inset-bottom)`.
 *   5. Position changes from `bottom-20` to `bottom-4` (no longer
 *      collides with WhatsApp button at `bottom: 88px`).
 *   6. Reject + Manage buttons stack vertically on `<sm` viewports
 *      (`flex-col sm:flex-row`).
 *
 * This test pins all six guarantees.
 */

import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

const COOKIE_SRC = fs.readFileSync(
  path.resolve(__dirname, '..', 'components', 'CookieConsent.tsx'),
  'utf8',
);
const FLOAT_CSS = fs.readFileSync(
  path.resolve(__dirname, '..', 'styles', 'floating-stack.css'),
  'utf8',
);

describe('CookieConsent — Issue #166 mobile layout regression pin', () => {
  it('z-index bumped from z-40 to z-[9100] (above FloatingStack 9050)', () => {
    expect(COOKIE_SRC).toMatch(/z-\[9100\]/);
    // The old z-40 must NOT remain on the consent banner outer div.
    // (Other z-* tokens elsewhere in the project are fine.)
    expect(COOKIE_SRC).not.toMatch(/cookie-consent-banner[\s\S]{0,300}\bz-40\b/);
  });

  it('outer container uses bottom-4 (no longer collides with WhatsApp at bottom 88)', () => {
    expect(COOKIE_SRC).toMatch(/cookie-consent-banner[\s\S]{0,200}bottom-4/);
    // bottom-20 was the cause of the WhatsApp overlap — must not return.
    expect(COOKIE_SRC).not.toMatch(/cookie-consent-banner[\s\S]{0,200}bottom-20/);
  });

  it('outer container adds env(safe-area-inset-bottom) padding for iPhone home indicator', () => {
    expect(COOKIE_SRC).toMatch(/paddingBottom:\s*['"]env\(safe-area-inset-bottom/);
  });

  it('inner panel has max-height anchored to 100dvh (not 100vh) and overflow-y auto', () => {
    expect(COOKIE_SRC).toMatch(/maxHeight:\s*['"][^'"]*100dvh/);
    expect(COOKIE_SRC).toMatch(/overflow-y-auto/);
    // Reject the legacy 100vh — Safari toolbar makes it shorter than expected.
    expect(COOKIE_SRC).not.toMatch(/maxHeight:\s*['"][^'"]*\b100vh\b/);
  });

  it('Reject + Manage buttons stack vertically on small screens', () => {
    expect(COOKIE_SRC).toMatch(/flex flex-col sm:flex-row gap-2/);
  });

  it('useEffect sets and clears document.body[data-cookie-consent-active]', () => {
    expect(COOKIE_SRC).toMatch(
      /document\.body\.setAttribute\(\s*['"]data-cookie-consent-active['"]/,
    );
    expect(COOKIE_SRC).toMatch(
      /document\.body\.removeAttribute\(\s*['"]data-cookie-consent-active['"]/,
    );
  });

  it('original consent legal copy is preserved (no legal meaning change)', () => {
    // Spot-check the canonical Hebrew + English titles to guarantee we did
    // not accidentally rewrite legal text in this UX-only PR.
    expect(COOKIE_SRC).toMatch(/Your Privacy Choices/);
    expect(COOKIE_SRC).toMatch(/העדפות פרטיות/);
  });

  it('original consent action handlers (acceptAll / rejectAll / manage) preserved', () => {
    expect(COOKIE_SRC).toMatch(/handleAcceptAll/);
    expect(COOKIE_SRC).toMatch(/handleRejectAll/);
    expect(COOKIE_SRC).toMatch(/handleManagePreferences/);
    expect(COOKIE_SRC).toMatch(/createAcceptAllConsent/);
    expect(COOKIE_SRC).toMatch(/createRejectAllConsent/);
  });
});

describe('floating-stack.css — Issue #166 suppression rule', () => {
  it('suppresses .pw-float-stack while cookie consent body attribute is set', () => {
    expect(FLOAT_CSS).toMatch(
      /body\[data-cookie-consent-active=['"]true['"]\]\s*\.pw-float-stack/,
    );
  });

  it('suppresses individual .pw-float buttons (defense-in-depth)', () => {
    expect(FLOAT_CSS).toMatch(
      /body\[data-cookie-consent-active=['"]true['"]\][\s\S]*\.pw-float\b/,
    );
  });

  it('suppression rule sets opacity:0 and pointer-events:none', () => {
    const block = FLOAT_CSS.match(
      /body\[data-cookie-consent-active=['"]true['"]\][\s\S]{0,400}/,
    )?.[0] ?? '';
    expect(block).toMatch(/opacity:\s*0/);
    expect(block).toMatch(/pointer-events:\s*none/);
  });

  it('original FloatingStack z-index unchanged (9050)', () => {
    // The fix uses CookieConsent z-index bump (9100) + body-attribute
    // suppression — it should NOT have lowered FloatingStack itself.
    expect(FLOAT_CSS).toMatch(/\.pw-float-stack\s*\{[\s\S]*z-index:\s*9050/);
  });
});
