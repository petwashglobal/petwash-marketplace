import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

/**
 * 2026-09-13: /account/security — the only screen where removing a sign-in
 * method or signing out every device requires Face ID / passkey (or password)
 * step-up — was routed in App.tsx but linked from nowhere, so the protection was
 * unreachable. It is now linked from My Account → Security.
 */
const R = (p: string) => readFileSync(resolve(__dirname, '..', '..', p), 'utf8');

describe('account security (step-up) screen is reachable', () => {
  it('is routed behind sign-in', () => {
    expect(R('client/src/App.tsx')).toMatch(/<Route path="\/account\/security">\s*\{\(\) => \(\s*<RequireAuth>\s*<AccountSecurity \/>/);
  });
  it('My Account → Security links to it', () => {
    const acct = R('client/src/pages/MyAccount.tsx');
    const tab = acct.slice(acct.indexOf('<TabsContent value="security"'));
    expect(tab.slice(0, 2500)).toContain('<Link href="/account/security" data-testid="link-account-security">');
  });
});
