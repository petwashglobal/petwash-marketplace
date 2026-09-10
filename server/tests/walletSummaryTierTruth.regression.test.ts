/**
 * GET /api/credit-wallet/summary — loyaltyTier must reflect Prestige enrollment.
 *
 * users.loyaltyTier is written as 'bronze' at signup for EVERY account and
 * WalletService.getWalletSummary defaults to 'bronze', so the summary told
 * /my-account that a non-enrolled member was "Bronze Member · 5% permanent
 * discount" (live QA 2026-09-09; capabilities.prestige.enrolled=false).
 * The route now answers 'new' unless an active privilegeMembers row exists
 * for the email — the same truth lib/userCapabilities uses.
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

const SRC = fs.readFileSync(path.resolve(__dirname, '../routes/credit-wallet.ts'), 'utf8');
const start = SRC.indexOf("router.get('/summary'");
const handler = SRC.slice(start, SRC.indexOf("router.", start + 10));

describe('credit-wallet summary tier truth', () => {
  it('the summary route exists', () => {
    expect(start).toBeGreaterThan(0);
  });
  it('looks enrollment up through the shared lib/memberTier helper (fail-closed there)', () => {
    expect(SRC).toContain("import { isPrestigeEnrolled } from '../lib/memberTier';");
    expect(SRC).not.toMatch(/async function isPrestigeEnrolled\(email/);
  });
  it("overrides loyaltyTier to 'new' unless enrolled, after spreading the service summary", () => {
    expect(handler).toContain("const prestigeEnrolled = await isPrestigeEnrolled(req.user?.email || req.firebaseUser?.email);");
    expect(handler).toMatch(/\.\.\.summary,\s*loyaltyTier: prestigeEnrolled \? summary\.loyaltyTier : 'new',/);
  });
});
