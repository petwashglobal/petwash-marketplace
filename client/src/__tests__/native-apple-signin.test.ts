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
const signin = fs.readFileSync(path.join(ROOT, 'pages', 'SignIn.tsx'), 'utf8');

describe('native Sign in with Apple', () => {
  it('exports a native-iOS guard + the native sign-in helper', () => {
    expect(handler).toMatch(/export function isNativeApplePlatform\(\)/);
    expect(handler).toMatch(/Capacitor\.isNativePlatform\(\)\s*&&\s*Capacitor\.getPlatform\(\)\s*===\s*'ios'/);
    expect(handler).toMatch(/export async function signInWithAppleNative\(/);
  });

  it('exchanges the native Apple token into Firebase with a raw nonce (Apple gets the hash)', () => {
    expect(handler).toMatch(/sha256Hex\(rawNonce\)/);
    expect(handler).toMatch(/new OAuthProvider\('apple\.com'\)/);
    expect(handler).toMatch(/provider\.credential\(\{ idToken, rawNonce \}\)/);
    expect(handler).toMatch(/signInWithCredential\(auth, credential\)/);
  });

  it('the plugin import is bundler-ignored (web build never resolves it)', () => {
    expect(handler).toMatch(/@vite-ignore/);
    expect(handler).not.toMatch(/from '@capacitor-community\/apple-sign-in'/); // never a static import
  });

  it('SignIn only takes the native path for apple + native platform, else web OAuth', () => {
    expect(signin).toMatch(/provider === 'apple' && isNativeApplePlatform\(\)/);
    expect(signin).toMatch(/userCredential = await signInWithAppleNative\(auth\)/);
    expect(signin).toMatch(/if \(!userCredential\) \{/); // web popup/redirect only when native didn't handle it
  });
});
