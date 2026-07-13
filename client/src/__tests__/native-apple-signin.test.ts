/**
 * Native Sign in with Apple (App Store rule 4.8) for the Capacitor iOS app.
 * Web keeps the OAuth popup/redirect; native uses the Apple sheet → Firebase
 * credential. Guarded so it only runs inside the native iOS app, and the plugin
 * import is bundler-ignored so the web build never tries to resolve it.
 *
 * Source-introspection (auth/Capacitor are runtime-bound).
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

const ROOT = path.resolve(__dirname, '..');
const handler = fs.readFileSync(path.join(ROOT, 'lib', 'iosAuthHandler.ts'), 'utf8');
// The old white SignIn.tsx page was killed in #1139 — ALL login was unified
// onto the premium screen (SignUpLuxury.tsx). The native-Apple decision now
// lives there.
const signin = fs.readFileSync(path.join(ROOT, 'pages', 'SignUpLuxury.tsx'), 'utf8');

describe('native Sign in with Apple', () => {
  it('exports a native-iOS guard + the native sign-in helper', () => {
    expect(handler).toMatch(/export function isNativeApplePlatform\(\)/);
    expect(handler).toMatch(/Capacitor\.isNativePlatform\(\)\s*&&\s*Capacitor\.getPlatform\(\)\s*===\s*'ios'/);
    expect(handler).toMatch(/export async function signInWithAppleNative\(/);
  });

  it('exchanges the native Apple token into Firebase via the Capacitor-8 firebase plugin', () => {
    // Apple Sign In now goes through @capacitor-firebase/authentication (Cap-8),
    // which generates the nonce + sends Apple the hash and returns the raw nonce.
    expect(handler).toMatch(/FirebaseAuthentication\.signInWithApple/);
    expect(handler).toMatch(/new OAuthProvider\('apple\.com'\)/);
    expect(handler).toMatch(/provider\.credential\(\{ idToken, rawNonce \}\)/);
    expect(handler).toMatch(/signInWithCredential\(auth, credential\)/);
  });

  it('the plugin import is bundler-ignored (web build never resolves it)', () => {
    expect(handler).toMatch(/@vite-ignore/);
    expect(handler).not.toMatch(/from '@capacitor-community\/apple-sign-in'/); // never a static import
  });

  it('the premium login only takes the native path for apple + native platform, else web OAuth', () => {
    // Unified login (SignUpLuxury.tsx, #1139): on a native platform the
    // apple/google branch uses the native sheet; otherwise it falls through
    // to the web provider (popup/redirect) path.
    expect(signin).toMatch(/isNativePlatform\(\)\s*&&\s*\(which === 'google' \|\| which === 'apple'\)/);
    expect(signin).toMatch(/await signInWithAppleNative\(auth\)/);
    // Native branch returns early; the web provider path only runs when the
    // native branch did NOT handle it.
    expect(signin).toMatch(/which === 'apple'\s*\?\s*createAppleProvider\(\)/);
  });
});
