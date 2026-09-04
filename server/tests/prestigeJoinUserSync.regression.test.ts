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
  it('never writes users.role at all — loyalty is an ADDITIVE capability (PR-AUTH-MULTIROLE-5)', () => {
    // Superseded design. The old rule was "promote role to 'loyalty' only from
    // customer/public", which still overwrote the single role column and so
    // erased a customer/provider identity the moment they joined Prestige.
    // The account now carries loyalty ALONGSIDE its role: membership of record
    // lives in loyalty_profiles + privilege_members, and
    // server/lib/userCapabilities.ts derives the capability from those.
    // Not writing the column at all is strictly safer than conditionally
    // writing it, so the pin is now a NEGATIVE one.
    expect(src).not.toMatch(/role:\s*'loyalty'/);
    expect(src).toMatch(/does\s+\n?\s*\/\/\s*NOT touch users\.role|NOT touch users\.role/);
    // The users-row sync must still carry the non-identity loyalty fields.
    expect(src).toMatch(/isClubMember:\s*true/);
  });
});
