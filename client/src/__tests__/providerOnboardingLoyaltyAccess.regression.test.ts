/**
 * Regression pin — #148 P1 (2026-07-25): a loyalty member must be able to open
 * provider onboarding to become ALSO a provider (additive both-roles flow). It
 * used to appear then bounce to /prestige/home because 'loyalty' was in the
 * blocked-role bounce list. Only internal/staff roles are bounced now.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const src = readFileSync(join(__dirname, '..', 'pages', 'ProviderOnboarding.tsx'), 'utf8');

describe('provider onboarding is reachable by a loyalty member (#148 P1)', () => {
  it('does not bounce loyalty from the provider KYC form', () => {
    const block = src.slice(src.indexOf('const blockedRoles'), src.indexOf('const blockedRoles') + 200);
    expect(block).not.toMatch(/'loyalty'/);
  });
  it('still bounces internal/staff roles', () => {
    const block = src.slice(src.indexOf('const blockedRoles'), src.indexOf('const blockedRoles') + 200);
    expect(block).toMatch(/'staff'/);
    expect(block).toMatch(/'super_admin'/);
  });
});
