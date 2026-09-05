/**
 * P0 (closure sprint) — /api/prestige-pass/staff/lookup and
 * /api/prestige-pass/staff/charge must be staff-only, not merely
 * authenticated.
 *
 * Both handlers only ever called `resolveUid(req)` — "does SOME PetWash
 * session/token exist" — never anything that checks the caller's role.
 * The staff-only gating lived exclusively in the client
 * (client/src/pages/staff/StaffScan.tsx renders the scan UI), which is
 * not an authorization boundary: any authenticated PetWash member could
 * call these routes directly with another member's cardId (the static
 * wallet-pass barcode) and:
 *
 *   /staff/lookup  — read a stranger's name, tier, pet info, and every
 *                    wallet balance (cash / eGift / promo / points).
 *   /staff/charge  — DEDUCT money from a stranger's wallet for an
 *                    arbitrary "service" up to ₪1,000 (staffChargeSchema
 *                    caps amountCents at 100_000), attributing the ring-up
 *                    to a "staffUserId" who was never actually staff.
 *
 * Fix: both routes now run requireStaffApproved (server/middleware/gates.ts)
 * — the same role+status gate every other staff/admin surface in this
 * codebase uses (role ∈ {staff, management, admin} AND
 * userStatus === 'staff_active', or a verified super-admin) — before the
 * handler body executes.
 *
 * A source pin because there is no live-DB integration harness in this
 * suite (see the sibling money-critical tests in this directory, e.g.
 * prestige-redeem-idempotency.test.ts) — this asserts the gate is
 * textually wired to both routes and can never be silently dropped by a
 * future refactor.
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

const SRC = fs.readFileSync(
  path.resolve(__dirname, '..', 'routes', 'prestige-pass.ts'),
  'utf8',
);

describe('P0 — prestige-pass staff POS routes require requireStaffApproved', () => {
  it('imports requireStaffApproved from the shared gates middleware', () => {
    expect(SRC).toMatch(/import\s*\{\s*requireStaffApproved\s*\}\s*from\s*'\.\.\/middleware\/gates'/);
  });

  it('/staff/lookup is gated by requireStaffApproved before its handler runs', () => {
    expect(SRC).toMatch(
      /router\.post\('\/staff\/lookup',\s*requireStaffApproved,\s*async/,
    );
  });

  it('/staff/charge is gated by requireStaffApproved before its handler runs', () => {
    expect(SRC).toMatch(
      /router\.post\('\/staff\/charge',\s*requireStaffApproved,\s*async/,
    );
  });

  it('/staff/charge derives staffUserId from resolveUid(), not a legacy session.user.uid that can throw for Firebase-only callers', () => {
    const start = SRC.indexOf("router.post('/staff/charge'");
    expect(start).toBeGreaterThan(-1);
    const block = SRC.slice(start, start + 700);
    expect(block).toMatch(/const staffUserId = resolveUid\(req\)!/);
    // The old crash-prone read: session may have no .user at all when the
    // caller authenticated via Firebase (this app's actual auth method —
    // see resolveUid()'s own doc comment above).
    expect(block).not.toMatch(/const staffUserId = session\.user\.uid/);
  });
});
