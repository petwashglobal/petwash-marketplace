/**
 * CEO §30 audit (2026-08-28) — eGift balance/reservations ACL.
 *
 * Prior state: /api/egift/:egiftId/balance +
 * /api/egift/:egiftId/reservations (+ commit + release) authenticated
 * the CALLER but never verified the eGift belonged to them. Any
 * authenticated user who obtained a valid egiftId could:
 *   - query balances they don't own,
 *   - move funds AVAILABLE → RESERVED for eGifts they don't own,
 *   - commit or release reservations they don't own.
 *
 * Fix: assertEgiftOwnership loads e_vouchers.owner_uid /
 * purchaser_uid and confirms one matches the caller (a VERIFIED
 * super-admin passes through for ops). Unknown eGifts and non-owner attempts both
 * return 404 (never 403) so the endpoint doesn't leak whether the id
 * exists to a non-owner. Fail-safe: DB error on the ACL read returns
 * 500 with a distinct code — a Postgres hiccup must NEVER downgrade
 * to "let the caller through".
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

const SRC = fs.readFileSync(
  path.resolve(__dirname, '..', 'routes', 'egift-balance.ts'),
  'utf8',
);

describe('egift-balance routes enforce eGift ownership ACL (CEO §30 audit)', () => {
  it('declares assertEgiftOwnership that reads owner_uid + purchaser_uid off e_vouchers', () => {
    expect(SRC).toMatch(/async function assertEgiftOwnership/);
    expect(SRC).toMatch(/SELECT owner_uid, purchaser_uid FROM e_vouchers/);
  });

  it('accepts either the ownerUid OR the purchaserUid — both routes into the eGift are honoured', () => {
    expect(SRC).toMatch(/row\.owner_uid === callerUid \|\| row\.purchaser_uid === callerUid/);
  });

  it('super-admin passes the ACL for ops — via the VERIFIED paired shape (#240)', () => {
    // Hardened 2026: the ops bypass used to be a bare allowlist match on a
    // caller-supplied email string. It is now isSuperAdminVerified(req),
    // which additionally requires firebaseUser.email_verified === true.
    // Pin the stronger shape, and pin OUT the weaker one so a future
    // refactor cannot silently downgrade the bypass back to email-only.
    expect(SRC).toMatch(/if \(isSuperAdminVerified\(req\)\) return \{ ok: true \}/);
    expect(SRC).toMatch(/isSuperAdminVerified.*from '\.\.\/middleware\/rbac'/);
    expect(SRC).not.toMatch(/isSuperAdmin\(callerEmail\)/);
  });

  it('non-owner + unknown egiftId BOTH return 404 — the endpoint does not confirm existence to a non-owner', () => {
    // Two distinct code paths in the helper both use { ok: false, status: 404 }.
    // Anchor the block so we're testing the helper, not a downstream route.
    const start = SRC.indexOf('async function assertEgiftOwnership');
    const end   = SRC.indexOf('\n}\n', start);
    const block = SRC.slice(start, end);
    // The row-not-found branch → 404.
    expect(block).toMatch(/if \(!row\) return \{ ok: false, status: 404 \}/);
    // The non-owner branch → 404 (never 403).
    expect(block).toMatch(/return \{ ok: false, status: 404 \}/);
    // No 403 is emitted from the helper.
    expect(block).not.toMatch(/status: 403/);
  });

  it('fails CLOSED on DB error — 500 with ACL_LOOKUP_FAILED, never a bypass to "allow through"', () => {
    expect(SRC).toMatch(/ownership lookup failed/);
    // The catch block must return status: 500, not { ok: true }.
    const catchIdx = SRC.indexOf('ownership lookup failed');
    expect(catchIdx).toBeGreaterThan(0);
    const window = SRC.slice(catchIdx, catchIdx + 400);
    expect(window).toMatch(/return \{ ok: false, status: 500 \}/);
    expect(window).not.toMatch(/return \{ ok: true \}/);
  });

  it('all four routes (balance GET + reserve POST + commit POST + release POST) call the ACL before acting', () => {
    // Anchor each router block, confirm assertEgiftOwnership call
    // sits BEFORE the projection / reserveFromEgift / commitReservation
    // / releaseByReservationId call.
    const anchors: { start: string; before: string }[] = [
      { start: "router.get('/:egiftId/balance'",                         before: 'projectEgiftBalance' },
      { start: "router.post('/:egiftId/reservations',",                  before: 'reserveFromEgift' },
      { start: "router.post('/:egiftId/reservations/:reservationId/commit'", before: 'commitReservation' },
      { start: "router.post('/:egiftId/reservations/:reservationId/release'", before: 'releaseByReservationId' },
    ];
    for (const a of anchors) {
      const startIdx = SRC.indexOf(a.start);
      expect(startIdx).toBeGreaterThan(0);
      // Next `router.` or export marks the end of THIS handler.
      const nextRouter = SRC.indexOf('\nrouter.', startIdx + a.start.length);
      const exportMark = SRC.indexOf('\nexport default', startIdx);
      const endIdx = Math.min(
        nextRouter > 0 ? nextRouter : SRC.length,
        exportMark > 0 ? exportMark : SRC.length,
      );
      const block = SRC.slice(startIdx, endIdx);
      const aclIdx = block.indexOf('assertEgiftOwnership');
      const actIdx = block.indexOf(a.before);
      expect(aclIdx).toBeGreaterThan(0);
      expect(actIdx).toBeGreaterThan(0);
      expect(aclIdx).toBeLessThan(actIdx);
    }
  });

  it('a failed ACL surfaces with a distinct code so a client cannot conflate NOT_FOUND with server error', () => {
    expect(SRC).toMatch(/error: acl\.status === 500 \? 'ACL_LOOKUP_FAILED' : 'NOT_FOUND'/);
  });
});
