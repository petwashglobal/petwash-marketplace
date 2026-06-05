import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = process.cwd();
const read = (path: string) => readFileSync(resolve(ROOT, path), 'utf8');

describe('Firebase social auth audit guardrails', () => {
  it('keeps Firebase Performance opt-in behind the social-auth fix flag', () => {
    const src = read('client/src/lib/firebase.ts');

    expect(src).toContain('VITE_FEATURE_SOCIAL_AUTH_FIXES');
    expect(src).toContain('VITE_FIREBASE_PERFORMANCE_ENABLED');
    expect(src).toContain("SOCIAL_AUTH_FIXES_ENABLED && !FIREBASE_PERFORMANCE_ENABLED");
    expect(src).toContain('Performance Monitoring skipped');

    const guardIndex = src.indexOf('SOCIAL_AUTH_FIXES_ENABLED && !FIREBASE_PERFORMANCE_ENABLED');
    const importIndex = src.indexOf("import('firebase/performance')");
    expect(guardIndex).toBeGreaterThan(-1);
    expect(importIndex).toBeGreaterThan(guardIndex);
  });

  it('keeps production Firebase Auth on the first-party domain', () => {
    const src = read('client/src/lib/firebase.ts');

    expect(src).toContain("import.meta.env.PROD\n      ? 'petwash.co.il'");
    expect(src).toContain("authDomain MUST be petwash.co.il in production builds");
    expect(src).toContain("VITE_FIREBASE_AUTH_DOMAIN || 'signinpetwash.firebaseapp.com'");
  });

  it('keeps Apple signup disabled until console config and revocation are verified', () => {
    const flags = read('client/src/lib/authSignupFlags.ts');
    const iosHandler = read('client/src/lib/iosAuthHandler.ts');

    expect(flags).toContain("appleSignin: off('VITE_AUTH_SIGNUP_APPLE_SIGNIN_ENABLED')");
    expect(iosHandler).toContain("new OAuthProvider('apple.com')");
    expect(iosHandler).toContain("provider.addScope('email')");
    expect(iosHandler).toContain("provider.addScope('name')");
  });
});
