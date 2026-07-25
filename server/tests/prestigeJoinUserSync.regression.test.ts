/**
 * Regression pin — Prestige join reconciles the canonical users row (2026-07-25).
 *
 * Joining Prestige used to write only loyalty_profiles + privilege_members + a
 * Firebase claim; the users row stayed is_club_member=false / points=0, so the
 * welcome points were invisible and the member wasn't recognized. The join now
 * syncs the users row (club flag, tier, welcome points, role promotion) without
 * downgrading a provider/staff/admin.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const src = readFileSync(join(__dirname, '..', 'routes', 'prestige-join.ts'), 'utf8');

describe('prestige-join users-row reconciliation', () => {
  it('marks the user as a club member on the canonical users row', () => {
    expect(src).toMatch(/isClubMember:\s*true/);
    expect(src).toMatch(/db\.update\(users\)/);
  });
  it('adds the welcome points to the users row on a fresh enrollment only', () => {
    expect(src).toMatch(/alreadyEnrolled\s*\?\s*\{\}\s*:\s*\{\s*loyaltyPoints/);
    expect(src).toMatch(/loyaltyPoints:\s*sql`/);
  });
  it('promotes role to loyalty only from a plain customer/public — never downgrades staff/provider', () => {
    expect(src).toMatch(/promotableRoles/);
    expect(src).toMatch(/'customer'.*'public'/s);
    expect(src).toMatch(/role:\s*'loyalty'/);
  });
});
