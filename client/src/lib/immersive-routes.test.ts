/**
 * Tests for the immersive-routes guard.
 *
 * Issue #153 — Shell Isolation Audit (CEO architectural directive).
 *
 * Locks the canonical immersive-route list and the matcher behaviour so
 * the next time someone adds a CTA, popup, or floating widget the test
 * suite — not a screenshot from the CEO — catches the leak.
 *
 * Coverage:
 *   A. Behaviour pins on isImmersiveRoute() and the IMMERSIVE_ROUTES list.
 *   B. Caller-integration source pins: App.tsx wraps the right global
 *      mounts; MobileBottomNav delegates to the helper; the legacy
 *      HIDDEN_PREFIXES list is gone.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { isImmersiveRoute, IMMERSIVE_ROUTES } from './immersive-routes';

const ROOT = resolve(__dirname, '..', '..', '..');
const read = (p: string) => readFileSync(resolve(ROOT, p), 'utf8');

// ── A. BEHAVIOUR ────────────────────────────────────────────────────────────

describe('isImmersiveRoute behaviour', () => {
  it('1. returns false for null / undefined / empty / non-string', () => {
    expect(isImmersiveRoute(null)).toBe(false);
    expect(isImmersiveRoute(undefined)).toBe(false);
    expect(isImmersiveRoute('')).toBe(false);
    expect(isImmersiveRoute(123 as any)).toBe(false);
    expect(isImmersiveRoute({} as any)).toBe(false);
  });

  it('2. returns false for non-immersive operational paths', () => {
    expect(isImmersiveRoute('/')).toBe(false);
    expect(isImmersiveRoute('/home')).toBe(false);
    expect(isImmersiveRoute('/booking/123')).toBe(false);
    expect(isImmersiveRoute('/admin/dashboard')).toBe(false);
    expect(isImmersiveRoute('/provider-os')).toBe(false);
    expect(isImmersiveRoute('/my-account')).toBe(false);
    expect(isImmersiveRoute('/franchise/dashboard')).toBe(false);
  });

  it('3. returns true for every entry in the canonical list', () => {
    for (const p of IMMERSIVE_ROUTES) {
      expect(isImmersiveRoute(p)).toBe(true);
    }
  });

  it('4. returns true for sub-paths (so multi-step forms stay immersive)', () => {
    expect(isImmersiveRoute('/provider-onboarding/step-2')).toBe(true);
    expect(isImmersiveRoute('/provider-onboarding/identity')).toBe(true);
    expect(isImmersiveRoute('/sign-in/passkey')).toBe(true);
    expect(isImmersiveRoute('/loyalty/join/welcome')).toBe(true);
    expect(isImmersiveRoute('/kyc/upload')).toBe(true);
    expect(isImmersiveRoute('/auth/action/oobCode')).toBe(true);
  });

  it('5. trailing slash variants normalise to immersive', () => {
    expect(isImmersiveRoute('/sign-in/')).toBe(true);
    expect(isImmersiveRoute('/signup/')).toBe(true);
    expect(isImmersiveRoute('/provider-onboarding/')).toBe(true);
    expect(isImmersiveRoute('/loyalty/join/')).toBe(true);
  });

  it('6. paths that only PREFIX an immersive entry are NOT matched', () => {
    // /provider must not match /provider-onboarding
    expect(isImmersiveRoute('/provider')).toBe(false);
    // /signinabc must not match /signin
    expect(isImmersiveRoute('/signinabc')).toBe(false);
    // /loyaltyabc must not match /loyalty
    expect(isImmersiveRoute('/loyaltyabc')).toBe(false);
    // /joined must not match /join
    expect(isImmersiveRoute('/joined')).toBe(false);
  });

  // ── Concrete CEO callouts ─────────────────────────────────────────────
  it('7. CEO list — every route the screenshot caller named is immersive', () => {
    expect(isImmersiveRoute('/sign-in')).toBe(true);
    expect(isImmersiveRoute('/signup')).toBe(true);
    expect(isImmersiveRoute('/provider-onboarding')).toBe(true);
    expect(isImmersiveRoute('/verify-email')).toBe(true);
    expect(isImmersiveRoute('/verify-phone')).toBe(true);
    expect(isImmersiveRoute('/complete-profile')).toBe(true);
    expect(isImmersiveRoute('/kyc')).toBe(true);
    expect(isImmersiveRoute('/loyalty/join')).toBe(true); // Prestige join
  });

  it('8. routes the legacy HIDDEN_PREFIXES list missed (the shell leak)', () => {
    // These are the entries the CEO\'s screenshot exposed: the bottom nav
    // bled through because MobileBottomNav HIDDEN_PREFIXES was missing them.
    expect(isImmersiveRoute('/loyalty/join')).toBe(true);
    expect(isImmersiveRoute('/apply-provider')).toBe(true);
    expect(isImmersiveRoute('/join-team')).toBe(true);
    expect(isImmersiveRoute('/join/walker')).toBe(true);
    expect(isImmersiveRoute('/join/sitter')).toBe(true);
    expect(isImmersiveRoute('/join/trainer')).toBe(true);
    expect(isImmersiveRoute('/activate-account')).toBe(true);
    expect(isImmersiveRoute('/consent-onboarding')).toBe(true);
    expect(isImmersiveRoute('/admin/kyc')).toBe(true);
    expect(isImmersiveRoute('/pet-wash-ltd/executive/kyc')).toBe(true);
    expect(isImmersiveRoute('/access-pending')).toBe(true);
    expect(isImmersiveRoute('/staff-pending')).toBe(true);
  });

  it('9. the Firebase email-link return route is immersive', () => {
    expect(isImmersiveRoute('/__/auth/action')).toBe(true);
    expect(isImmersiveRoute('/auth/action')).toBe(true);
    // With realistic query-string scenarios (router strips them, but tests
    // the path-only matcher)
    expect(isImmersiveRoute('/__/auth/action/oobCode')).toBe(true);
  });
});

// ── B. CALLER INTEGRATION SOURCE PINS ───────────────────────────────────────

describe('PR-SHELL-IMMERSIVE caller-integration pins', () => {
  it('10. App.tsx imports isImmersiveRoute', () => {
    const src = read('client/src/App.tsx');
    expect(src).toMatch(/import\s*\{\s*isImmersiveRoute\s*\}\s*from\s*['"]@\/lib\/immersive-routes['"]/);
  });

  it('11. App.tsx wraps MobileBottomNav with !isImmersiveRoute', () => {
    const src = read('client/src/App.tsx');
    // showMobileNav = !isImmersive
    expect(src).toMatch(/const\s+showMobileNav\s*=\s*!isImmersive/);
    // and the mount honours it
    expect(src).toMatch(/\{showMobileNav\s*&&\s*<MobileBottomNav\s*\/>\}/);
  });

  it('12. App.tsx PromoAdPopup gate now uses isImmersiveRoute (no legacy regex)', () => {
    const src = read('client/src/App.tsx');
    expect(src).toMatch(/const\s+showPromoPopup\s*=\s*!isImmersive/);
    // The drifting all-purpose PROMO_EXCLUDED_PATTERN regex is gone
    expect(src).not.toMatch(/PROMO_EXCLUDED_PATTERN/);
  });

  it('13. App.tsx FloatingStack gate now uses isImmersiveRoute (no legacy regex)', () => {
    const src = read('client/src/App.tsx');
    expect(src).toMatch(/const\s+showFloatingStack\s*=\s*!isImmersive/);
    expect(src).not.toMatch(/FLOATING_WIDGETS_EXCLUDED_PATTERN/);
  });

  it('14. MobileBottomNav imports isImmersiveRoute and uses it as the suppression check', () => {
    const src = read('client/src/components/MobileBottomNav.tsx');
    expect(src).toMatch(/import\s*\{\s*isImmersiveRoute\s*\}\s*from\s*['"]@\/lib\/immersive-routes['"]/);
    expect(src).toMatch(/if\s*\(\s*isImmersiveRoute\(\s*location\s*\)\s*\)\s*return\s+null/);
  });

  it('15. MobileBottomNav legacy HIDDEN_PREFIXES list is retired', () => {
    const src = read('client/src/components/MobileBottomNav.tsx');
    // The old constant must be gone — anything remaining is the retirement
    // doc-comment which references the name without redefining it.
    expect(src).not.toMatch(/^const\s+HIDDEN_PREFIXES\s*=\s*\[/m);
  });

  it('16. Helper list locks the SHIP-NOW critical entries', () => {
    // Spot-check a representative sample so a future drift to the list
    // (e.g. someone removing /kyc) fails fast.
    const must = [
      '/sign-in', '/signup', '/provider-onboarding', '/verify-email',
      '/verify-phone', '/complete-profile', '/kyc', '/loyalty/join',
      '/apply-provider', '/join-team', '/join/walker', '/admin/kyc',
      '/__/auth/action', '/access-pending',
    ];
    for (const p of must) expect(IMMERSIVE_ROUTES).toContain(p);
  });
});
