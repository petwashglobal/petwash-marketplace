/**
 * PR-COOKIE-CONSENT-IMMERSIVE-GATE — fire-order item 58.
 *
 * CookieConsent was previously mounted with only a !isNativeApp gate.
 * That let it render on every immersive route (signup / signin /
 * verify / KYC / provider-onboarding / admin/login-v2 / …) where it
 * could overlay the primary CTA. Added the !isImmersive gate the
 * promo popup + floating widgets already use.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const ROOT = resolve(__dirname, '..', '..');
const APP = 'client/src/App.tsx';

describe('PR-COOKIE-CONSENT-IMMERSIVE-GATE', () => {
  const src = readFileSync(resolve(ROOT, APP), 'utf8');

  it('A1. CookieConsent is gated on both !isNativeApp AND !isImmersive', () => {
    // The wrapping conditional must include the immersive check.
    expect(/\{\s*!isNativeApp\s*&&\s*!isImmersive\s*&&\s*\(\s*<CookieConsent/.test(src)).toBe(true);
  });

  it('A2. CookieConsent is NOT mounted with only the pre-fix !isNativeApp gate', () => {
    // Guard: nowhere else in App.tsx should mount CookieConsent with
    // ONLY !isNativeApp (that was the pre-fix pattern that leaked into
    // immersive flows).
    expect(/\{\s*!isNativeApp\s*&&\s*\(\s*<CookieConsent/.test(src)).toBe(false);
  });
});
