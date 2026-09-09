/**
 * /api/credit-wallet/summary — loyaltyTier must reflect Prestige enrollment.
 *
 * users.loyaltyTier is written as 'bronze' at signup for EVERY account
 * (AuthService, WalletService, social-oauth…), so it cannot say whether the
 * member joined PetWash Prestige. Live QA 2026-09-09: an account with
 * capabilities.prestige.enrolled=false was rendered "Bronze Member · 5%
 * permanent discount". The summary now answers 'new' unless an active
 * privilegeMembers row exists for the email — the same truth
 * lib/userCapabilities uses.
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

const SRC = fs.readFileSync(path.resolve(__dirname, '../routes/wallet.ts'), 'utf8');

describe('wallet summary tier truth', () => {
  it('looks enrollment up in privilegeMembers by email, on the Postgres client', () => {
    expect(SRC).toMatch(/async function isPrestigeEnrolled\(email/);
    expect(SRC).toMatch(/await pgDb\s*\.select\(\{ status: privilegeMembers\.status \}\)\s*\.from\(privilegeMembers\)\s*\.where\(eq\(privilegeMembers\.email, email\.toLowerCase\(\)\)\)/);
  });
  it("answers 'new' unless enrolled, and never trusts loyaltyTier alone", () => {
    expect(SRC).toMatch(/const tier = \(await isPrestigeEnrolled\(userData\?\.email \|\| \(req as any\)\.user\?\.email\)\)\s*\? \(userData\?\.loyaltyTier \|\| 'bronze'\)\s*: 'new';/);
    const summary = SRC.slice(SRC.indexOf("router.get('/summary'"), SRC.indexOf('const points = userData?.loyaltyPoints', SRC.indexOf("router.get('/summary'")));
    expect(summary).not.toContain("const tier = userData?.loyaltyTier || 'new';");
  });
  it('fails closed to not-enrolled on lookup errors', () => {
    expect(SRC).toMatch(/prestige lookup failed \(defaulting not enrolled\)/);
  });
});
