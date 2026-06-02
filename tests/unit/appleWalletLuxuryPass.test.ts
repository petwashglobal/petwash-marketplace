import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const read = (file: string) => fs.readFileSync(path.join(root, file), 'utf8');
const size = (file: string) => fs.statSync(path.join(root, file)).size;

describe('Apple Wallet clean Prestige pass model', () => {
  it('uses real clean luxury artwork instead of 1x1 placeholder pass assets', () => {
    expect(size('wallet/apple-model.pass/icon.png')).toBeGreaterThan(100);
    expect(size('wallet/apple-model.pass/logo.png')).toBeGreaterThan(100);
    expect(size('wallet/apple-model.pass/strip.png')).toBeGreaterThan(1_000);
    expect(size('client/src/assets/prestige-card-black.png')).toBeGreaterThan(500_000);
  });

  it('renders Royal founder passes as bright white membership passes with safe links', () => {
    const service = read('server/services/AppleWalletService.ts');
    expect(service).toContain('rgb(255,255,255)');
    expect(service).toContain('rgb(0,0,0)');
    expect(service).toContain('rgb(176,132,28)');
    expect(service).toContain('memberName');
    expect(service).toContain('storedCredit');
    expect(service).not.toContain('ROYAL Member');
    expect(service).toContain('PetWash Website');
    expect(service).toContain('/prestige-pass');
    expect(service).toContain('PKBarcodeFormatPDF417');
    expect(service).toContain('PETWASH_PASS_LOCATIONS_JSON');
    expect(service).toContain('appLaunchURL');
    expect(service).toContain("|| 'https://petwash.co.il'");
    expect(service).toContain('buildApplePassAuthToken');
  });

  it('keeps the pass model in the final white crystal Prestige family', () => {
    const model = JSON.parse(read('wallet/apple-model.pass/pass.json'));
    expect(model.passTypeIdentifier).toBe('pass.il.petwash.prestige');
    expect(model.logoText).toBe('PetWash');
    expect(model.backgroundColor).toBe('rgb(255,255,255)');
    expect(model.foregroundColor).toBe('rgb(0,0,0)');
    expect(model.labelColor).toBe('rgb(176,132,28)');
    expect(model.storeCard).toBeTruthy();
  });

  it('does not use raw user ids as Apple pass web-service authentication tokens', () => {
    const tokens = read('server/lib/passTokens.ts');
    const routes = read('server/routes/pass-universal.ts');
    expect(tokens).toContain('buildApplePassAuthToken');
    expect(tokens).toContain('verifyApplePassAuthToken');
    expect(routes).toContain('ApplePass ');
    expect(routes).toContain('verifyApplePassRequest');
    expect(read('server/services/AppleWalletService.ts')).not.toContain('authenticationToken:        visual.userId');
  });

  it('keeps Google Wallet parity for Royal/Founder and web action links', () => {
    const googleWallet = read('server/services/GoogleWalletService.ts');
    expect(googleWallet).toContain('#FFFFFF');
    expect(googleWallet).toContain('STORED CREDIT');
    expect(googleWallet).toContain('/book');
    expect(googleWallet).toContain('/prestige-pass');
    expect(googleWallet).toContain('rotatingBarcode');
  });
});
