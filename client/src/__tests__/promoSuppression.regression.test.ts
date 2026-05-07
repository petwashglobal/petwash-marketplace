/**
 * Issue #148 P3 — regression pin.
 *
 * The PROMO_EXCLUDED_PATTERN regex in App.tsx historically matched
 * `/provider/*` (with slash) but missed `/provider-onboarding`,
 * `/become-provider`, `/join*`, `/verify-email`, etc. — every sticky
 * onboarding route that doesn't have `/` immediately after the prefix.
 *
 * Result on mobile: the z-9999 PromoAdPopup mounted on top of the
 * onboarding form and blocked the bottom-edge "Complete" CTAs on
 * iPhone Safari.
 *
 * The fix AND-conditions both `showPromoPopup` and `showFloatingStack`
 * with `isStickyAccountPath(currentPath)`. This pin guarantees:
 *   1. App.tsx imports the canonical helper
 *   2. Both visibility flags consult it
 * If anyone removes the import or the AND clause, this test fails.
 */

import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';
import {
  isStickyAccountPath,
  STICKY_ACCOUNT_PATHS,
} from '@/lib/sticky-account-paths';

const APP_SRC = fs.readFileSync(
  path.resolve(__dirname, '..', 'App.tsx'),
  'utf8',
);

describe('App.tsx — promo + floating-stack suppression on sticky paths (Issue #148 P3)', () => {
  it('imports isStickyAccountPath from the canonical helper', () => {
    expect(APP_SRC).toMatch(
      /import\s*\{\s*isStickyAccountPath\s*\}\s*from\s*['"]@\/lib\/sticky-account-paths['"]/,
    );
  });

  it('showPromoPopup AND-conditions on isStickyAccountPath(currentPath)', () => {
    expect(APP_SRC).toMatch(
      /showPromoPopup\s*=[\s\S]{0,200}!isStickyAccountPath\(\s*currentPath\s*\)/,
    );
  });

  it('showFloatingStack AND-conditions on isStickyAccountPath(currentPath)', () => {
    expect(APP_SRC).toMatch(
      /showFloatingStack\s*=[\s\S]{0,200}!isStickyAccountPath\(\s*currentPath\s*\)/,
    );
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
