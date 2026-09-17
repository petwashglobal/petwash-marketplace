import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

/**
 * 2026-09-17: the CEO opened /join/walker on his phone, signed in with the
 * admin account, and got the admin sign-in screen ("your 4-hour admin session
 * ended"). Staff/admin accounts can't apply as providers; the page used to
 * bounce them silently to their own home — the admin area. It now says why.
 */
const src = readFileSync(resolve(__dirname, '../pages/ProviderOnboarding.tsx'), 'utf8');

describe('provider onboarding with a staff/admin account', () => {
  it('no longer redirects silently', () => {
    const effect = src.slice(src.indexOf("const blockedRoles = new Set(["), src.indexOf('/** Where this internal account belongs'));
    expect(effect).toContain('setInternalRole(role);');
    expect(effect).not.toContain('navigate(');
  });
  it('explains it in Hebrew and English, with a way to switch account', () => {
    expect(src).toContain("'החשבון הזה הוא חשבון צוות'");
    expect(src).toContain('חשבונות ניהול וצוות לא נרשמים כנותני שירות');
    expect(src).toContain("await logout(); navigate('/sign-in?redirect=/provider-onboarding');");
    expect(src).toContain('data-testid="button-go-to-my-area"');
  });
  it('the notice renders before the form', () => {
    expect(src.indexOf('if (internalRole) {')).toBeGreaterThan(0);
    expect(src.indexOf('if (internalRole) {')).toBeLessThan(src.lastIndexOf('{/* Close Button - Top Right */}'));
  });
});
