/**
 * GET /api/prestige-pass/wallet issues a pass to MEMBERS, not to visitors
 * — regression pin (2026-09-13).
 *
 * Carried over from #2467's "Not in this PR (CEO decision)" list:
 * "/prestige-pass/wallet still auto-creates a public_member pass doc for any
 * visitor, so the 'not a member → join' redirect never fires."
 *
 * The route created a prestige_passes doc for ANY signed-in caller on first
 * access, so it could never answer "you are not a member" — it always had a
 * pass to return. PrestigePassWallet.tsx keys its redirect to
 * /loyalty/join?reason=prestige_required on exactly that answer (ok:false),
 * so the join gate was unreachable, and a membership-card identity was minted
 * for accounts that never enrolled.
 *
 * Enrollment truth is the shared one: an ACTIVE privilege_members row for the
 * account's own email (lib/memberTier.isPrestigeEnrolled).
 *
 * Source-level pins: this route needs Firestore + Firebase auth + Postgres
 * together, so the pins assert the gate exists, sits BEFORE the write, and
 * keeps the client contract — rather than standing that stack up.
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

const ROUTE = fs.readFileSync(
  path.resolve(__dirname, '..', 'routes', 'prestige-pass.ts'),
  'utf8',
);
const CLIENT = fs.readFileSync(
  path.resolve(__dirname, '..', '..', 'client', 'src', 'pages', 'PrestigePassWallet.tsx'),
  'utf8',
);
const MEMBER_TIER = fs.readFileSync(
  path.resolve(__dirname, '..', 'lib', 'memberTier.ts'),
  'utf8',
);

/** The auto-create block of GET /wallet. */
function createBlock(): string {
  const start = ROUTE.indexOf('A PASS IS ISSUED TO MEMBERS');
  expect(start).toBeGreaterThan(-1);
  const end = ROUTE.indexOf("collection('prestige_passes').doc(userId).set(passData)", start);
  expect(end).toBeGreaterThan(start);
  return ROUTE.slice(start, end);
}

describe('prestige pass is not minted for non-members (2026-09-13)', () => {
  it('the enrollment gate runs before the pass doc is written', () => {
    const block = createBlock();
    expect(block).toMatch(/isPrestigeEnrolled/);
    expect(block).toMatch(/NOT_A_MEMBER/);
    // the early return must precede the serial/doc write inside the same block
    expect(block.indexOf('NOT_A_MEMBER')).toBeLessThan(
      block.indexOf('const serialNumber') === -1 ? Number.MAX_SAFE_INTEGER : block.indexOf('const serialNumber'),
    );
  });

  it('a non-member gets ok:false — the shape the client redirect keys on', () => {
    expect(createBlock()).toMatch(/ok:\s*false/);
    // client contract: ok === false sends the visitor to the join page
    expect(CLIENT).toMatch(/walletData\.ok === false/);
    expect(CLIENT).toMatch(/loyalty\/join\?reason=prestige_required/);
  });

  it('the gate reads the account\'s own email, not a client-supplied one', () => {
    expect(createBlock()).toMatch(/passOwner.*email|users\.id, userId/s);
  });

  it('enrollment means an ACTIVE privilege_members row (pending is not a member)', () => {
    expect(MEMBER_TIER).toMatch(/status\s*\?\?\s*'active'\)\s*===\s*'active'/);
  });
});
