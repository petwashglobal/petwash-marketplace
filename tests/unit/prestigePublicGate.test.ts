import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const read = (file: string) => fs.readFileSync(path.join(root, file), 'utf8');

describe('Prestige public application gate', () => {
  const prestigeClub = read('client/src/pages/PrestigeClub.tsx');
  const waitlist = read('client/src/pages/PrestigeInterestWaitlist.tsx');
  const app = read('client/src/App.tsx');
  const cta = read('client/src/components/PrestigeWalletCTA.tsx');

  it('routes logged-out Prestige interest through the dedicated 18+ waitlist', () => {
    expect(app).toContain('PrestigeInterestWaitlist');
    expect(app).toContain('path="/prestige/waitlist"');
    expect(app).toContain('path="/prestige/apply"');
    expect(cta).toContain('href="/prestige/waitlist"');
    expect(prestigeClub).toContain('href="/prestige/waitlist"');
  });

  it('does not promise automatic membership, Wallet pass issuance, or fake approval', () => {
    expect(waitlist).toContain('over 18');
    expect(waitlist).toContain('not membership approval');
    expect(waitlist).toContain('not Wallet issuance');
    expect(waitlist).toContain('No fake Wallet pass');
  });

  it('uses the real public lead pipeline instead of local-only demo storage', () => {
    expect(waitlist).toContain('/api/global-forms/sales-lead');
    expect(waitlist).not.toMatch(/localStorage\.setItem\([^)]*waitlist/i);
    expect(waitlist).not.toMatch(/Math\.random\(\)/);
  });

  it('keeps private insurance and company cost details out of public pages', () => {
    for (const source of [prestigeClub, waitlist]) {
      expect(source).not.toMatch(/insurance premium/i);
      expect(source).not.toMatch(/insurance fee/i);
      expect(source).not.toMatch(/policy number/i);
      expect(source).not.toMatch(/company secret/i);
    }
  });

  it('removes old placeholder/yellow membership copy from the public Prestige landing', () => {
    expect(prestigeClub).not.toContain('Join for free');
    expect(prestigeClub).not.toContain('הצטרפות חינם');
    expect(prestigeClub).not.toContain('Yellow Diamond');
    expect(prestigeClub).not.toContain('design placeholder');
    expect(prestigeClub).not.toContain('דוגמה להצגה בלבד');
  });

  it('keeps provider application copy approval-based instead of promising instant earnings or fixed fees', () => {
    const providerForm = read('client/src/pages/ProviderApplicationForm.tsx');
    expect(providerForm).toContain('Approval requires photo, address, rates, documents');
    expect(providerForm).toContain('Payout preview only');
    expect(providerForm).not.toContain('start earning! The leading pet services platform');
    expect(providerForm).not.toContain('15% platform commission');
  });
});
