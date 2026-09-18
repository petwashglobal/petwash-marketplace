/**
 * THE BOOKING AND GIFT-CARD PASSES ASKED FOR CERTIFICATES UNDER NAMES NOBODY SET.
 *
 * CEO, 2026-09-19: the pass would not install on iPhone. It was never a
 * Content-Type problem, a Capacitor problem, or a client problem — the server
 * decided it had no certificates and refused to build a pass at all.
 *
 * Two Apple Wallet generators live in this repo and they read DIFFERENT
 * environment variables for the SAME signing material:
 *
 *   services/AppleWalletService.ts   APPLE_TEAM_IDENTIFIER / APPLE_WWDR_PEM /
 *                                    APPLE_SIGNER_CERT_PEM / APPLE_SIGNER_KEY_PEM
 *   appleWallet.ts                   APPLE_TEAM_ID / APPLE_WWDR_CERT /
 *                                    APPLE_SIGNER_CERT / APPLE_SIGNER_KEY
 *
 * The *_PEM set is the configured one — production logs show
 * /api/pass/apple/:token generating a real pkpass, and
 * admin-create-founder-pass.yml documents those names as the required secrets.
 * Nothing aliased the two sets.
 *
 * So the member/Prestige pass (pass-universal, prestige-pass → the PEM file)
 * worked, while the BOOKING pass (routes/wallet.ts), the GIFT CARD pass
 * (routes/gift-cards.ts) and the CEO pass (routes/ceo-wallet.ts) — all three
 * on the other file — were dead. One pass installs, another will not.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const R = (p: string) => readFileSync(resolve(__dirname, '..', p), 'utf8');
/** Source minus comments — a pin must not pass on its own explanation. */
const code = (src: string): string =>
  src.split('\n').filter((l) => {
    const t = l.trim();
    return !t.startsWith('//') && !t.startsWith('*') && !t.startsWith('/*');
  }).join('\n');

const legacy = code(R('appleWallet.ts'));
const modern = code(R('services/AppleWalletService.ts'));

describe('both generators accept the SAME configured names', () => {
  for (const name of ['APPLE_TEAM_IDENTIFIER', 'APPLE_WWDR_PEM', 'APPLE_SIGNER_CERT_PEM', 'APPLE_SIGNER_KEY_PEM']) {
    it(`${name} is read by both files`, () => {
      expect(modern, `${name} missing from the working generator`).toContain(name);
      expect(legacy, `${name} missing from the generator that was dead`).toContain(name);
    });
  }

  it('the legacy names still work, so an old environment does not break', () => {
    expect(legacy).toMatch(/APPLE_WWDR_PEM \|\| process\.env\.APPLE_WWDR_CERT/);
    expect(legacy).toMatch(/APPLE_SIGNER_CERT_PEM \|\| process\.env\.APPLE_SIGNER_CERT/);
    expect(legacy).toMatch(/APPLE_SIGNER_KEY_PEM \|\| process\.env\.APPLE_SIGNER_KEY/);
    expect(legacy).toMatch(/APPLE_TEAM_IDENTIFIER \|\| process\.env\.APPLE_TEAM_ID/);
  });

  it('no cert is read straight from process.env any more — one place decides', () => {
    // A second direct read is how the two sets drifted apart in the first place.
    expect(legacy).not.toMatch(/wwdr: process\.env\./);
    expect(legacy).not.toMatch(/signerCert: process\.env\./);
    expect(legacy).not.toMatch(/signerKey: process\.env\.APPLE_SIGNER_KEY\b/);
  });
});

describe('a pass is never signed with a made-up team', () => {
  it("the '000000000' fallback is gone", () => {
    // A pass whose teamIdentifier does not match the signing certificate
    // downloads and then refuses to open — to a customer that is simply
    // "the pass is broken".
    expect(legacy).not.toContain("'000000000'");
  });

  it('the configuration check requires the team identifier too', () => {
    const fn = legacy.slice(legacy.indexOf('hasValidCertificates'));
    expect(fn).toMatch(/APPLE_TEAM_IDENTIFIER &&/);
    expect(fn).toMatch(/APPLE_WWDR &&/);
    expect(fn).toMatch(/APPLE_SIGNER_CERT &&/);
    expect(fn).toMatch(/APPLE_SIGNER_KEY/);
  });

  it('the failure message names the variables that are actually read', () => {
    // It used to name APPLE_WWDR_CERT etc — sending whoever hit it to set the
    // very names that do not work.
    expect(legacy).toMatch(/APPLE_SIGNER_KEY_PEM/);
    expect(legacy).not.toMatch(/Please set APPLE_WWDR_CERT/);
  });
});

describe('the passes that were dead go through the fixed generator', () => {
  for (const [label, file] of [
    ['booking pass', 'routes/wallet.ts'],
    ['gift-card pass', 'routes/gift-cards.ts'],
    ['CEO pass', 'routes/ceo-wallet.ts'],
  ] as const) {
    it(`${label} imports it`, () => {
      expect(code(R(file))).toMatch(/from '\.\.\/appleWallet'/);
    });
  }
});
