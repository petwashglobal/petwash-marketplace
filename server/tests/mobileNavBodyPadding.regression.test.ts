/**
 * PR-MOBILE-NAV-BODY-PADDING — fire-order item 9.
 *
 * MobileBottomNav is position:fixed at the bottom of the viewport,
 * 56px tall + safe-area-inset-bottom, z-40. Pages that render OUTSIDE
 * the <Layout> wrapper (e.g. /egift, /booking) had NO reserved bottom
 * space — the nav overlaid the primary CTA on mobile.
 *
 * Fix: App.tsx toggles `data-pw-mobile-nav="on"` on <html> whenever the
 * nav is mounted; a CSS rule in index.css reserves body bottom padding
 * on mobile only when the attribute is set. Desktop and immersive
 * routes are unaffected.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

const ROOT = resolve(__dirname, '..', '..');
const APP = 'client/src/App.tsx';
const CSS = 'client/src/index.css';

function read(rel: string): string { return readFileSync(resolve(ROOT, rel), 'utf8'); }

describe('PR-MOBILE-NAV-BODY-PADDING', () => {
  const app = read(APP);
  const css = read(CSS);

  it('A1. App.tsx defines MobileNavBodyPaddingToggle helper', () => {
    expect(existsSync(resolve(ROOT, APP))).toBe(true);
    // Actual signature: function MobileNavBodyPaddingToggle({ enabled }: { enabled: boolean }) {
    expect(/function\s+MobileNavBodyPaddingToggle\s*\(\s*\{\s*enabled\s*\}\s*:\s*\{\s*enabled\s*:\s*boolean\s*\}\)/.test(app)).toBe(true);
  });

  it('A2. helper toggles data-pw-mobile-nav on the <html> root element', () => {
    expect(/root\.setAttribute\(\s*['"]data-pw-mobile-nav['"]\s*,\s*['"]on['"]\s*\)/.test(app)).toBe(true);
    expect(/root\.removeAttribute\(\s*['"]data-pw-mobile-nav['"]\s*\)/.test(app)).toBe(true);
  });

  it('A3. helper is mounted alongside the nav (same showMobileNav gate)', () => {
    // The two lines must be adjacent so the attribute state can never
    // drift out of sync with the nav mount state.
    expect(app.includes('{showMobileNav && <MobileBottomNav />}')).toBe(true);
    expect(app.includes('<MobileNavBodyPaddingToggle enabled={showMobileNav} />')).toBe(true);
  });

  it('B1. index.css scopes the padding rule to mobile (max-width: 767px)', () => {
    // Desktop keeps its md: layout where the nav is hidden (`md:hidden`
    // in MobileBottomNav.tsx), so the rule MUST NOT apply above 767px.
    expect(/@media\s*\(\s*max-width:\s*767px\s*\)/.test(css)).toBe(true);
  });

  it('B2. index.css applies padding-bottom only when data-pw-mobile-nav="on" is set', () => {
    // Gated by the html attribute — so immersive routes (auth/KYC/
    // onboarding) that don't mount the nav ALSO don't carry padding.
    expect(/html\[data-pw-mobile-nav\s*=\s*['"]on['"]\]\s+body\s*\{[\s\S]*?padding-bottom\s*:\s*calc\(\s*56px\s*\+\s*env\(\s*safe-area-inset-bottom[^)]*\)\s*\)/m.test(css)).toBe(true);
  });

  it('B3. padding value accounts for safe-area-inset-bottom (iPhone home indicator)', () => {
    // iPhone Safari with home indicator needs env(safe-area-inset-bottom)
    // added on top of the nav height so the nav does not visually
    // clip into the home indicator zone.
    expect(css.includes('env(safe-area-inset-bottom')).toBe(true);
  });
});
