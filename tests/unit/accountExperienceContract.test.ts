import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const read = (file: string) => fs.readFileSync(path.join(root, file), 'utf8');

describe('PetWash member and provider experience contract', () => {
  const account = read('client/src/pages/MyAccount.tsx');
  const accountCss = read('client/src/styles/my-account-luxury.css');
  // ProviderDashboard.tsx was a dead Replit-era duplicate deleted in #691; the
  // canonical provider surface is now ProviderHome.tsx (+ ProviderOS). The
  // "readiness before work is payable" contract moved there.
  const providerHome = read('client/src/pages/ProviderHome.tsx');
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

  it('uses the canonical brand gold instead of old yellow/orange account tokens', () => {
    // Brand rebrand 2026-06-18: the account surface moved to the canonical
    // bright METALLIC gold #D4AF37 (brand palette). The earlier champagne
    // #b0841c was superseded — do not "restore" it. The command-center
    // structure and the ban on old yellow/orange tokens stay.
    expect(accountCss).toContain('.pw-command-center');
    expect(accountCss).toMatch(/#D4AF37/i);
    expect(accountCss).not.toContain('--gold-400: #b0841c');
    expect(accountCss).not.toContain('#f5d76e 0%, #d4af37');
  });

  it('shows provider readiness before work can feel active or payable', () => {
    // Re-pointed to the canonical ProviderHome. The readiness contract is the
    // same: an application-status card shows until approved, and a
    // documents/compliance panel makes clear those items are REQUIRED TO
    // RECEIVE PAYOUTS — work never feels payable before readiness is met.
    expect(providerHome).toContain('Documents & Compliance');
    expect(providerHome).toMatch(/required to receive payouts/i);
    // Approval gate: the application-status card is shown until approved.
    expect(providerHome).toMatch(/!\['approved', 'approved_as_provider'\]\.includes\(appStatus\)/);
    expect(providerHome).toMatch(/complete any missing documents to speed up approval/i);
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
