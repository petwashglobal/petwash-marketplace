/**
 * Google/Apple sign-in must NOT dead-end when the popup is blocked.
 *
 * Live fault (2026-08-06): clicking "Continue with Google" on the login page threw
 * `auth/popup-blocked` and just showed an error — leaving the user on the login page.
 * That is the "gmail does nothing / bounces back to login" complaint. On desktop +
 * non-iOS browsers the popup strategy is chosen, and popup blockers / strict browsers
 * / embedded webviews silently block signInWithPopup. The handler must fall back to
 * the full-page redirect (which always works) instead of stranding the user.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const src = readFileSync(resolve(__dirname, '..', 'SignUpLuxury.tsx'), 'utf8');
// Only the social() catch block — after the popup call.
const catchBlock = src.slice(src.indexOf('const cancelSignal'));

describe('social sign-in popup → redirect fallback', () => {
  it('detects a blocked/unsupported popup (not just user-cancel)', () => {
    expect(catchBlock).toMatch(/cancelSignal\.includes\('popup-blocked'\)/);
    expect(catchBlock).toMatch(/operation-not-supported-in-this-environment/);
  });
  it('falls back to signInWithRedirect for google/apple/facebook instead of dead-ending', () => {
    expect(catchBlock).toMatch(/popupFailed && \(which === 'google' \|\| which === 'apple' \|\| which === 'facebook'\)/);
    expect(catchBlock).toMatch(/await signInWithRedirect\(auth, redirectProvider\)/);
  });
  it('still returns silently on a deliberate user cancel (no fallback, no error banner)', () => {
    expect(catchBlock).toMatch(/popup-closed-by-user'\) \|\| cancelSignal\.includes\('cancel'\)\) return/);
  });
});
