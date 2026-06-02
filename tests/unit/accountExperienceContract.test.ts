import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const read = (file: string) => fs.readFileSync(path.join(root, file), 'utf8');

describe('PetWash member and provider experience contract', () => {
  const account = read('client/src/pages/MyAccount.tsx');
  const accountCss = read('client/src/styles/my-account-luxury.css');
  const providerDashboard = read('client/src/pages/ProviderDashboard.tsx');
  const loyaltyDashboard = read('client/src/pages/LoyaltyDashboard.tsx');
  const egift = read('client/src/pages/EGift.tsx');
  const settings = read('client/src/pages/Settings.tsx');

  it('keeps the account dashboard as a real operating home, not a thin profile form', () => {
    expect(account).toContain('PrestigeAccountCommandCenter');
    expect(account).toContain('Prestige Account Command Center');
    expect(account).toContain('Wallet Pass Download');
    expect(account).toContain('Address & Proximity Matching');
    expect(account).toContain('Gift & Store Credit Journey');
    expect(account).toContain('Provider Readiness');
    expect(account).toContain('/wallet-download');
    expect(account).toContain('/buy-gift-card');
  });

  it('uses Nir-approved champagne gold instead of old yellow/orange account tokens', () => {
    expect(accountCss).toContain('--gold-400: #b0841c');
    expect(accountCss).toContain('.pw-command-center');
    expect(accountCss).not.toContain('--gold-400: #d4af37');
    expect(accountCss).not.toContain('#f5d76e 0%, #d4af37');
  });

  it('shows provider readiness before work can feel active or payable', () => {
    expect(providerDashboard).toContain('ProviderReadinessCommandPanel');
    expect(providerDashboard).toContain('Provider Readiness Command Center');
    expect(providerDashboard).toContain('מס, חוזה, ביטוח ובנק');
    expect(providerDashboard).toContain('MISSING');
    expect(providerDashboard).toContain('READY');
  });

  it('makes loyalty a wallet and credit operating product, not only points', () => {
    expect(loyaltyDashboard).toContain('LoyaltyOperatingStrip');
    expect(loyaltyDashboard).toContain('Loyalty Operating System');
    expect(loyaltyDashboard).toContain('Download Pass');
    expect(loyaltyDashboard).toContain('Every redemption tracked');
    expect(loyaltyDashboard).toContain('#b0841c');
    expect(loyaltyDashboard).not.toContain("from-purple-500 to-violet-600");
  });

  it('explains the eGift recipient journey and credit separation before checkout', () => {
    expect(egift).toContain('EgiftJourneyPanel');
    expect(egift).toContain('Recipient journey');
    expect(egift).toContain('Payment, receipt & audit');
    expect(egift).toContain('Credit separation');
    expect(egift).toContain('Paid, refund, loyalty and promotional credit stay separate');
    expect(egift).not.toContain('#c9a96e');
    expect(egift).not.toContain('#d4af37');
  });

  it('keeps settings tied to downstream security, wallet, notification and evidence effects', () => {
    expect(settings).toContain('SettingsControlMap');
    expect(settings).toContain('Settings Control Map');
    expect(settings).toContain('Every setting knows its downstream effect');
    expect(settings).toContain('Wallet consent controls pass delivery');
    expect(settings).toContain('#b0841c');
    expect(settings).not.toContain('#C9A96E');
    expect(settings).not.toContain('#D4AF37');
  });
});
