import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

/**
 * CEO flow "Returning User – Sign in with Google" (2026-09-12), screens 3 + 4:
 *   3. "Nice to see you again! Signing you in…" with the mascot while the
 *      server decides (SigningInMoment, shown by SignUpLuxury at BOTH
 *      post-login sites)
 *   4. Welcome Back with the founder's brand dog photo
 * Pins the wiring so a refactor cannot silently drop the moment.
 */
const R = (p: string) => readFileSync(resolve(__dirname, '..', '..', '..', p), 'utf8');
const SU = R('client/src/pages/SignUpLuxury.tsx');
const SM = R('client/src/components/auth/SigningInMoment.tsx');
const WB = R('client/src/pages/WelcomeBack.tsx');

describe('Signing-in moment (screen 3)', () => {
  it('SignUpLuxury shows the moment at both post-login sites and renders it full-screen', () => {
    expect(SU).toContain("import { SigningInMoment } from '@/components/auth/SigningInMoment'");
    expect((SU.match(/setSigningIn\(\{ returning: isReturningFirebaseUser\(/g) || []).length).toBe(2);
    expect(SU).toMatch(/if \(signingIn\) \{\s*return <SigningInMoment he=\{he\} returning=\{signingIn\.returning\} \/>;/);
  });

  it('decides returning vs new from the Firebase record, not a guess', () => {
    expect(SU).toMatch(/function isReturningFirebaseUser/);
    expect(SU).toContain('return last - created > 60_000;');
  });

  it('carries the CEO copy in both languages and the mascot photo', () => {
    expect(SM).toContain('Nice to see you again!');
    expect(SM).toContain('כיף לראות אותך שוב!');
    expect(SM).toContain('Signing you in…');
    expect(SM).toContain('מחברים אותך…');
    expect(SM).toContain("'/brand/kenzo-avatar.jpeg'");
    expect(SM).toContain('data-testid="signing-in-moment"');
    // centred with inline style — Tailwind text-center is dead under html[lang="he"]
    expect(SM).toContain("style={{ textAlign: 'center' }}");
  });
});

describe('Welcome Back (screen 4) uses the brand photo', () => {
  it('hero is the founder-owned bandana dog served from /brand', () => {
    expect(WB).toContain("'/brand/hero-dog-lux.jpg'");
    expect(WB).not.toContain('petwash-station-real');
  });
});
