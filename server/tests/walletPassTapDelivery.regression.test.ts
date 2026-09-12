import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

/**
 * Wallet-pass delivery audit 2026-09-12 ("my wallet download to iPhone won't work"):
 *  1. Inside the native app shell (Capacitor WKWebView) or a home-screen PWA a
 *     same-window navigation to a .pkpass dies silently — only real Safari can
 *     install a pass. Those contexts must be handed to the system browser.
 *  2. Apple and Google buttons received the SAME universal URL, so an iPhone
 *     user tapping "Google Wallet" was UA-redirected into the Apple rail.
 *  3. The universal Apple route sent no Cache-Control behind the CDN.
 */
const R = (p: string) => readFileSync(resolve(__dirname, '..', '..', p), 'utf8');
const PAGE = R('client/src/pages/PrestigePassWallet.tsx');
const PP = R('server/routes/prestige-pass.ts');
const PU = R('server/routes/pass-universal.ts');

describe('wallet pass tap reaches a browser that can install it', () => {
  it('native shell + standalone PWA open the pass in the system browser; Safari navigates in place', () => {
    expect(PAGE).toContain("import { Capacitor } from '@capacitor/core';");
    const fn = PAGE.slice(PAGE.indexOf('const walletDownloadMutation'), PAGE.indexOf('const walletDownloadMutation') + 2200);
    expect(fn).toMatch(/standalone === true/);
    expect(fn).toMatch(/display-mode: standalone/);
    expect(fn).toMatch(/if \(Capacitor\.isNativePlatform\(\) \|\| standalone\) \{\s*window\.open\(url, '_blank', 'noopener'\);/);
    expect(fn).toContain('window.location.assign(url);');
  });
});

describe('Apple and Google get their own rails', () => {
  it('googleWalletUrl points at /api/pass/google/<token>, Apple at the universal link', () => {
    expect(PP).toMatch(/appleWalletUrl: `\$\{baseUrl\}\/api\/pass\/\$\{token\}`/);
    expect(PP).toMatch(/googleWalletUrl: `\$\{baseUrl\}\/api\/pass\/google\/\$\{token\}`/);
    expect(PP).not.toMatch(/return \{ appleWalletUrl: url, googleWalletUrl: url \}/);
  });
});

describe('the universal Apple pass response is never CDN-cached', () => {
  it('sends Cache-Control: no-store on the pkpass', () => {
    const block = PU.slice(PU.indexOf("router.get('/apple/:token'"), PU.indexOf("router.get('/google/:token'"));
    expect(block).toContain("res.setHeader('Content-Type', 'application/vnd.apple.pkpass');");
    expect(block).toContain("res.setHeader('Cache-Control', 'no-store, private');");
  });
});
