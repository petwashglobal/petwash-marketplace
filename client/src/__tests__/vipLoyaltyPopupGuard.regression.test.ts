/**
 * Issue #153 PR-VIP-LOYALTY-MOBILE-GUARD — latent body-scroll-lock risk.
 *
 * Deep scroll-lock audit (post-#194) flagged:
 *   client/src/components/VIPLoyaltyPopup.tsx:97-106
 *   `document.body.style.overflow = 'hidden'` UNCONDITIONALLY when
 *   isOpen=true. No mobile guard, no isImmersiveRoute() check.
 *
 * If this popup ever auto-mounts on an auth / onboarding / KYC route
 * (or simply mounts during a route transition), the body lock fires
 * and reproduces the iPhone Safari freeze pattern PR #194 hot-fixed in
 * the immersive CSS — same blast radius, different surface.
 *
 * The popup itself is `fixed inset-0 z-[9999] bg-white overflow-y-auto`
 * (line 121) — a full-screen opaque overlay with its own scroller.
 * The body lock was only ever needed to stop the page BEHIND from
 * scrolling on normal (non-immersive) routes. On immersive routes
 * there is no useful behaviour the lock provides — only risk.
 *
 * Smallest surgical fix: gate the body lock with isImmersiveRoute().
 * On immersive routes, never touch body scroll. On other routes,
 * preserve the original modal-lock behaviour exactly.
 *
 * Source-pin tests only — no real DOM render.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const ROOT = resolve(__dirname, '..', '..', '..');
const src = readFileSync(
  resolve(ROOT, 'client/src/components/VIPLoyaltyPopup.tsx'),
  'utf8',
);

describe('PR-VIP-LOYALTY-MOBILE-GUARD — body-lock immersive guard', () => {
  it('1. imports the canonical isImmersiveRoute helper', () => {
    expect(src).toMatch(
      /import\s*\{\s*isImmersiveRoute\s*\}\s*from\s*['"]@\/lib\/immersive-routes['"]/,
    );
  });

  it('2. body-lock useEffect early-returns when on an immersive route', () => {
    // The guard must run BEFORE the lock. If isImmersiveRoute(currentPath)
    // is true, the effect must clear any inherited lock and bail.
    // Strip comments first so the retirement-comment text doesn't
    // false-positive the indexOf anchor.
    const noComments = src
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/^\s*\/\/.*$/gm, '');
    const idx = noComments.indexOf('useEffect(() => {');
    expect(idx).toBeGreaterThan(0);
    const window_ = noComments.slice(idx, idx + 1500);
    // Guard call (real CODE, not a comment)
    expect(window_).toMatch(/isImmersiveRoute\(\s*window\.location\.pathname\s*\)/);
    // Defensive cleanup of any inherited lock + early return
    const guardIdx = window_.indexOf('isImmersiveRoute(window.location.pathname)');
    expect(guardIdx).toBeGreaterThan(0);
    const subsequent = window_.slice(guardIdx, guardIdx + 400);
    expect(subsequent).toMatch(/document\.body\.style\.overflow\s*=\s*['"]['"]/);
    expect(subsequent).toMatch(/return/);
  });

  it('3. ssr-safe — window check before any DOM mutation', () => {
    const idx = src.indexOf('useEffect(() => {');
    const window_ = src.slice(idx, idx + 200);
    expect(window_).toMatch(/typeof\s+window\s*===\s*['"]undefined['"]/);
  });

  it('4. preserves the original modal-lock behaviour on non-immersive routes', () => {
    // After the immersive early-return, the existing isOpen branch
    // must remain so the popup still locks body on normal pages
    // (where the page behind would otherwise scroll).
    expect(src).toMatch(/if\s*\(\s*isOpen\s*\)\s*\{[\s\S]{0,80}body\.style\.overflow\s*=\s*['"]hidden['"]/);
    expect(src).toMatch(/return\s*\(\)\s*=>\s*\{[\s\S]{0,80}body\.style\.overflow\s*=\s*['"]['"]/);
  });

  it('5. retirement comment documents the latent freeze risk + #194 link', () => {
    expect(src).toMatch(/PR-VIP-LOYALTY-MOBILE-GUARD/);
    expect(src).toMatch(/#194|hot-?fix/i);
    expect(src).toMatch(/iPhone Safari/i);
  });

  it('6. popup overlay shape unchanged (still fixed inset-0 z-[9999] with own scroller)', () => {
    // Sanity: this PR is NOT a redesign. The overlay must remain
    // a full-screen opaque modal with its own scroller — that's what
    // makes the body lock unnecessary on immersive routes.
    expect(src).toMatch(/fixed\s+inset-0\s+z-\[9999\]\s+bg-white\s+overflow-y-auto/);
  });

  it('7. no other body-style mutation introduced (only overflow is touched)', () => {
    // Defensive: this PR must NOT introduce position: fixed, height
    // overrides, or touch-action mutations — those would replicate
    // the exact bug we are guarding against.
    const idx = src.indexOf('useEffect(() => {');
    const window_ = src.slice(idx, idx + 1500);
    expect(window_).not.toMatch(/body\.style\.position/);
    expect(window_).not.toMatch(/body\.style\.height/);
    expect(window_).not.toMatch(/body\.style\.touchAction/);
    expect(window_).not.toMatch(/documentElement\.style/);
  });

  it('8. popup remains under #187 React-level suppression boundary on immersive routes (defence-in-depth)', () => {
    // App.tsx already gates PromoAdPopup / FloatingStack via
    // !isImmersive. The new guard inside this component is the
    // BELT to that BRACES — both layers defend the freeze pattern.
    // Confirm App.tsx still has the boundary so we don't regress one
    // layer while patching the other.
    const app = readFileSync(resolve(ROOT, 'client/src/App.tsx'), 'utf8');
    expect(app).toMatch(/showPromoPopup\s*=\s*!isImmersive/);
    expect(app).toMatch(/showFloatingStack\s*=\s*!isImmersive/);
    expect(app).toMatch(/showMobileNav\s*=\s*!isImmersive/);
  });
});
