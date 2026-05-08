/**
 * Issue #148 P3 — regression pin (UPDATED post-#187 SHELL-IMMERSIVE).
 *
 * Original symptom: PROMO_EXCLUDED_PATTERN regex in App.tsx historically
 * matched `/provider/*` (with slash) but missed `/provider-onboarding`,
 * `/become-provider`, `/join*`, `/verify-email`, etc. The z-9999
 * PromoAdPopup mounted on top of the onboarding form and blocked the
 * bottom-edge "Complete" CTAs on iPhone Safari.
 *
 * #148 P3 fix: AND `showPromoPopup` / `showFloatingStack` with
 * `isStickyAccountPath`.
 *
 * #187 PR-SHELL-IMMERSIVE evolution: the suppression check moved from
 * `isStickyAccountPath` to the broader canonical `isImmersiveRoute`
 * helper. Every sticky path is also immersive (immersive is a strict
 * superset), so the original #148 contract is preserved AND extended
 * to additional routes (`/loyalty/join`, `/apply-provider`, `/join-team`,
 * `/kyc`, `/admin/kyc`, `/access-pending`, `/__/auth/action`, etc.).
 *
 * This pin now asserts:
 *   1. App.tsx imports both helpers (sticky for legacy, immersive
 *      for the post-#187 source of truth).
 *   2. The visibility flags consult `isImmersiveRoute` (the canonical
 *      post-#187 boundary).
 *   3. `isImmersiveRoute` returns true for every previously-leaking
 *      path that #148 P3 was protecting — the contract is preserved
 *      under the helper rename.
 */

import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';
import {
  isStickyAccountPath,
  STICKY_ACCOUNT_PATHS,
} from '@/lib/sticky-account-paths';
import { isImmersiveRoute } from '@/lib/immersive-routes';

const APP_SRC = fs.readFileSync(
  path.resolve(__dirname, '..', 'App.tsx'),
  'utf8',
);

describe('App.tsx — promo + floating-stack suppression on sticky/immersive paths (Issue #148 P3 + #187 SHELL-IMMERSIVE)', () => {
  it('imports the canonical helpers (sticky for legacy + immersive for post-#187 boundary)', () => {
    expect(APP_SRC).toMatch(
      /import\s*\{\s*isStickyAccountPath\s*\}\s*from\s*['"]@\/lib\/sticky-account-paths['"]/,
    );
    expect(APP_SRC).toMatch(
      /import\s*\{\s*isImmersiveRoute\s*\}\s*from\s*['"]@\/lib\/immersive-routes['"]/,
    );
  });

  it('showPromoPopup AND-conditions on !isImmersive (the canonical post-#187 boundary)', () => {
    expect(APP_SRC).toMatch(
      /showPromoPopup\s*=[\s\S]{0,200}!isImmersive/,
    );
  });

  it('showFloatingStack AND-conditions on !isImmersive (the canonical post-#187 boundary)', () => {
    expect(APP_SRC).toMatch(
      /showFloatingStack\s*=[\s\S]{0,200}!isImmersive/,
    );
  });

  it('every previously-leaking #148 path is still suppressed (contract preserved under #187 rename)', () => {
    // The whole point of #148 P3 was to suppress popups/FAB on these
    // routes. After #187 the gate moved from sticky to immersive — but
    // every one of these MUST still be suppressed.
    for (const p of [
      '/provider-onboarding',
      '/provider-onboarding/step-2',
      '/become-provider',
      '/join',
      '/join/walker',
      '/join/sitter',
      '/join/trainer',
      '/verify-email',
    ]) {
      expect(isImmersiveRoute(p)).toBe(true);
    }
  });

  it('canonical sticky path helper still recognises the routes that were leaking the popup', () => {
    // These are the exact paths the old regex missed.
    const previously_leaking = [
      '/provider-onboarding',
      '/provider-onboarding/step-2',
      '/become-provider',
      '/join',
      '/join/walker',
      '/join/sitter',
      '/join/trainer',
      '/verify-email',
    ];
    for (const p of previously_leaking) {
      expect(isStickyAccountPath(p)).toBe(true);
    }
  });

  it('canonical sticky list still covers every leaking path (no silent removal)', () => {
    for (const required of [
      '/provider-onboarding',
      '/become-provider',
      '/join',
      '/verify-email',
    ]) {
      expect(STICKY_ACCOUNT_PATHS).toContain(required);
    }
  });
});
