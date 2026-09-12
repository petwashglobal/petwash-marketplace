import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

/**
 * Onboarding audit 2026-09-12 — the loops a brand-new Google/Apple member fell into:
 *  P0-39 read the Terms for 6 minutes → "send code" → REAUTH_REQUIRED → sign in → same form
 *  P0-40 the Terms link was an in-app navigation that wiped the typed form
 *  P1-41 a 30-second cached post-login answer bounced the just-completed member back
 *  P0-4  /terms and /privacy showed an older generation of the documents the consent binds to
 */
const R = (p: string) => readFileSync(resolve(__dirname, '..', '..', p), 'utf8');

describe('first-time phone capture is onboarding, not a change', () => {
  it('request-change demands recent auth only when a phone already exists', () => {
    const s = R('server/routes/profile-settings.ts');
    expect(s).toContain('const isFirstPhone = !phoneRow?.phone;');
    expect(s).toContain('if (!isFirstPhone && !hasRecentAuth(decodedToken)) {');
    expect(s).not.toMatch(/\n    if \(!hasRecentAuth\(decodedToken\)\) \{\n      logger\.warn\('\[ProfileSettings\] Phone change denied/);
  });
});

describe('/complete-profile keeps the member in the form', () => {
  it('legal links open the registry documents in a new tab; post-login cache is invalidated on submit', () => {
    const s = R('client/src/pages/CompleteProfile.tsx');
    expect(s).toContain('<a href="/legal/customer-terms" target="_blank" rel="noopener"');
    expect(s).toContain('<a href="/legal/privacy" target="_blank" rel="noopener"');
    expect(s).not.toMatch(/<Link href="\/terms"/);
    expect(s).toContain('invalidatePostLoginCache();\n      const postLogin: any = await resolvePostLogin({});');
  });
});

describe('/terms and /privacy are the documents the consent lines bind to', () => {
  it('redirect to /legal/customer-terms and /legal/privacy; the old pages are no longer routed', () => {
    const app = R('client/src/App.tsx');
    expect(app).toContain('<Route path="/terms">{() => <Redirect to="/legal/customer-terms" />}</Route>');
    expect(app).toContain('<Route path="/privacy">{() => <Redirect to="/legal/privacy" />}</Route>');
    expect(app).toContain('<Route path="/privacy-policy">{() => <Redirect to="/legal/privacy" />}</Route>');
    expect(app).not.toContain('component={Terms}');
    expect(app).not.toContain('component={PrivacyPolicy}');
    expect(app).toContain('<Route path="/legal/customer-terms">');
    expect(app).toContain('<Route path="/legal/privacy">');
  });
});
