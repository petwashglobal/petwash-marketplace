/**
 * /my-account must not invent a loyalty tier.
 *
 * Live QA 2026-09-09: an account with capabilities.prestige.enrolled=false
 * rendered "BRONZE MEMBER · 5% permanent discount on all services". The
 * wallet summary sends loyaltyTier 'new' for non-enrolled members and the
 * page mapped anything unknown to Bronze.
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

const SRC = fs.readFileSync(path.resolve(__dirname, 'MyAccount.tsx'), 'utf8');

describe('MyAccount — non-enrolled members are "Member", not Bronze', () => {
  it("has an explicit 'new' tier with no discount", () => {
    expect(SRC).toMatch(/\n  new: \{[\s\S]*?label: 'Member',[\s\S]*?discount: 0\n  \},/);
  });
  it("defaults a missing/unknown tier to 'new', never to bronze", () => {
    expect(SRC).toContain("const tier = wallet?.loyaltyTier?.toLowerCase() || 'new';");
    expect(SRC).toContain('const tierInfo = tierConfig[tier] || tierConfig.new;');
  });
  it('shows a Join Prestige door instead of a progress bar when not enrolled', () => {
    expect(SRC).toContain('data-testid="account-prestige-not-enrolled"');
    expect(SRC).toMatch(/<Link href="\/prestige\/enroll"[^>]*data-testid="account-prestige-join"/);
    expect(SRC).toContain('{isPrestigeMember && nextTierInfo && (');
  });
});
