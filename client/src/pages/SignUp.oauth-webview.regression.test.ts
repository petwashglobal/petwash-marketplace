/**
 * Issue #153 Mission-X PR-1 — OAuth in-app browser regression pin.
 *
 * BEFORE this fix:
 *   `client/src/pages/SignUp.tsx` rendered 5 OAuth buttons (Google,
 *   Apple, Facebook, TikTok, Instagram). The page detected in-app
 *   browsers (Instagram, TikTok, generic webview) at `:99-106` and
 *   set `webviewBlocked = true`. A warning banner showed at `:845`,
 *   BUT the OAuth buttons themselves only had
 *   `disabled={!!socialLoading || loading}` — they did NOT honor
 *   `webviewBlocked`. A user inside an Instagram in-app browser:
 *     1. saw the banner saying "use Safari/Chrome"
 *     2. tapped "Continue with Google" anyway
 *     3. OAuth silently failed (Google blocks popups/redirects from
 *        in-app browsers)
 *     4. user was stuck — no error, no fallback CTA
 *   This was the exact CEO complaint: "Mobile sign up wrong, Gmail
 *   or Apple must work or email."
 *
 * AFTER this fix:
 *   All 5 OAuth buttons honor `webviewBlocked`:
 *     disabled={!!socialLoading || loading || webviewBlocked}
 *   They also receive `aria-disabled` and `title` hints so assistive
 *   tech and hover users see the reason. The phone OTP toggle and
 *   email/password form below are unaffected — they remain the
 *   working fallback when webviewBlocked is true.
 *
 * This source-pin test fails if any of the 5 OAuth buttons drops the
 * `webviewBlocked` check.
 */

import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

const SRC = fs.readFileSync(
  path.resolve(__dirname, 'SignUp.tsx'),
  'utf8',
);

describe('SignUp.tsx — Issue #153 Mission-X PR-1 OAuth webview gating', () => {
  it('still detects webview at module-level useEffect (Instagram / TikTok / generic)', () => {
    expect(SRC).toMatch(/setWebviewBlocked\(\s*isInstagram\s*\|\|\s*isTikTok\s*\|\|\s*isGenericWebview\s*\)/);
  });

  it('still renders the Hebrew + English webview warning banner', () => {
    expect(SRC).toMatch(/הרשמה עם Google\/Apple\/Facebook דורשת דפדפן מלא/);
    expect(SRC).toMatch(/Google\/Apple\/Facebook sign-up requires a full browser/);
  });

  // For each of the 5 OAuth buttons, the disabled clause MUST include
  // webviewBlocked. We anchor the assertion to the test-id so the test
  // points at the exact button on failure.
  for (const testId of [
    'button-google-signup',
    'button-apple-signup',
    'button-facebook-signup',
    'button-tiktok-signup',
    'button-instagram-signup',
  ]) {
    it(`OAuth button [${testId}] is disabled when webviewBlocked is true`, () => {
      // Find the JSX block for this button by data-testid and assert the
      // surrounding disabled clause includes webviewBlocked. We allow the
      // disabled clause to appear within ~600 characters before or after
      // the test-id since the JSX prop order is not guaranteed.
      const idx = SRC.indexOf(`data-testid="${testId}"`);
      expect(idx).toBeGreaterThan(0);
      // Look back up to 800 chars to find the disabled clause for this button.
      const window = SRC.slice(Math.max(0, idx - 800), idx + 200);
      expect(window).toMatch(/disabled=\{[^}]*\bwebviewBlocked\b[^}]*\}/);
    });
  }

  it('phone OTP toggle remains usable when webviewBlocked is true', () => {
    // The phone signup toggle must NOT include webviewBlocked in its
    // disabled clause — phone OTP is the intentional fallback for
    // in-app browsers.
    const phoneIdx = SRC.indexOf('data-testid="button-phone-signup-toggle"');
    expect(phoneIdx).toBeGreaterThan(0);
    const window = SRC.slice(Math.max(0, phoneIdx - 800), phoneIdx + 200);
    // disabled exists but webviewBlocked is NOT in it.
    expect(window).toMatch(/disabled=\{[^}]*\}/);
    expect(window).not.toMatch(/disabled=\{[^}]*\bwebviewBlocked\b[^}]*\}/);
  });

  it('OAuth buttons surface the reason via title attribute when blocked', () => {
    // The accessibility hint must reference Safari/Chrome so the user
    // (and screen readers) know what to do.
    expect(SRC).toMatch(/title=\{webviewBlocked\s*\?\s*\([\s\S]{0,200}Safari/);
    expect(SRC).toMatch(/title=\{webviewBlocked\s*\?\s*\([\s\S]{0,200}Chrome/);
  });

  it('OAuth buttons set aria-disabled when blocked (assistive-tech parity)', () => {
    const matches = SRC.match(/aria-disabled=\{webviewBlocked/g);
    expect(matches?.length).toBe(5);
  });

  it('original webview-detection regexes preserved', () => {
    // Defensive: the agent investigation flagged that webview detection
    // is the only line of defense. If a future PR weakens it, this test
    // surfaces the change.
    expect(SRC).toMatch(/\/Instagram\/i\.test\(ua\)/);
    expect(SRC).toMatch(/\/BytedanceWebview\|musical_ly\/i\.test\(ua\)/);
    expect(SRC).toMatch(/\/wv\|WebView\/i\.test\(ua\)/);
  });
});
