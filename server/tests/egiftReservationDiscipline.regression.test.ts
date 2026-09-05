/**
 * CEO §22-24, §28-29 discipline pins for the eGift reservation service.
 *
 * Source-pin regression — encodes the invariants that keep the
 * reservation lifecycle honest. A refactor that quietly changes any of
 * these must trip this test:
 *
 * §22  reserve() pre-checks AVAILABLE via the honest projection
 *      (never trusts wallet_accounts.egift_balance_cents alone) and
 *      returns EGIFT_FROZEN / EGIFT_NOT_FOUND / INSUFFICIENT_AVAILABLE
 *      instead of oversuffing.
 * §23  the RACE_CONDITION path re-projects INSIDE the transaction
 *      after insert and rolls back when available drops below zero.
 *      Two concurrent reserves against the SAME eGift can never both
 *      succeed if together they exceed available.
 * §28  release() writes RESERVATION_RELEASED (never REDEEMED / VALUE_RESTORED).
 *      Cancelling a hold is NOT a refund.
 * §29  commit() writes REDEEMED (never RESERVATION_RELEASED).
 *      REDEEMED entries are what the balance projection subtracts;
 *      a caller-side race that would double-commit hits
 *      RESERVATION_NOT_ACTIVE.
 * TTL  reserve() caps ttlSeconds at 900s server-side. A caller
 *      asking for a longer hold gets clipped, never trusted.
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

const SRC = fs.readFileSync(
  path.resolve(__dirname, '..', 'services', 'egift', 'egiftReservationService.ts'),
  'utf8',
);

describe('§22 reserve() pre-check discipline', () => {
  it('uses projectEgiftBalance() as the AVAILABLE source of truth — never a bare wallet_accounts read', () => {
    // The pre-check MUST run through the honest projection so open
    // reservations count against the customer's available cents.
    expect(SRC).toMatch(/const beforeProjection = await projectEgiftBalance\(input\.egiftId\)/);
    // Ban a direct wallet_accounts read inside reserve() — that would
    // silently accept a spend that a competing hold has already
    // reserved.
    const reserveBlock = SRC.slice(
      SRC.indexOf('export async function reserveFromEgift'),
      SRC.indexOf('export async function commitReservation'),
    );
    expect(reserveBlock).not.toMatch(/pool\.query.*wallet_accounts/);
    expect(reserveBlock).not.toMatch(/db\.select.*walletAccounts/i);
  });

  it('returns EGIFT_FROZEN when the projection reports frozen — never lets a frozen egift bleed money', () => {
    expect(SRC).toMatch(/if\s*\(beforeProjection\.frozen\)[\s\S]*?errorCode:\s*'EGIFT_FROZEN'/);
  });

  it('returns EGIFT_NOT_FOUND when there is no evidence of the egift at all', () => {
    // originalCents=0 AND restoredCents=0 AND no open reservations
    // → the id is invalid (or fresh env). Never proceed.
    expect(SRC).toMatch(/originalCents === 0[\s\S]*?restoredCents === 0[\s\S]*?openReservations\.length === 0/);
    expect(SRC).toMatch(/errorCode:\s*'EGIFT_NOT_FOUND'/);
  });

  it('returns INSUFFICIENT_AVAILABLE strictly on available < requested', () => {
    // The compare is `<` not `<=` — a customer with exactly ₪X
    // available spending ₪X is legal.
    expect(SRC).toMatch(/if\s*\(beforeProjection\.availableCents\s*<\s*amount\)/);
    expect(SRC).toMatch(/errorCode:\s*'INSUFFICIENT_AVAILABLE'/);
  });
});

describe('§23 in-transaction race guard', () => {
  it('re-projects AFTER the insert and rolls back on negative available', () => {
    expect(SRC).toMatch(/const afterProjection = await projectEgiftBalance\(input\.egiftId\)/);
    expect(SRC).toMatch(/if\s*\(afterProjection\.availableCents\s*<\s*0\)/);
    // The rollback path calls the release helper on the freshly-
    // inserted reservationId with silent=true so the honest error
    // reaches the caller instead of a spurious warning.
    // The compensating release now also passes the reservation's OWN egiftId,
    // because releaseByReservationId requires the authorisation scope (P0 fix:
    // reservation ops used to resolve by reservationId alone).
    expect(SRC).toMatch(/releaseByReservationId\(reservationId,\s*input\.egiftId,\s*\/\*silent=\*\/\s*true\)/);
    expect(SRC).toMatch(/errorCode:\s*'RACE_CONDITION'/);
  });
});

describe('§28 release() NEVER writes REDEEMED', () => {
  it('release writes RESERVATION_RELEASED, never REDEEMED / VALUE_RESTORED', () => {
    const releaseBlock = SRC.slice(
      SRC.indexOf('export async function releaseByReservationId'),
      SRC.indexOf('function deterministicReservationId'),
    );
    expect(releaseBlock).toMatch(/eventType:\s*'RESERVATION_RELEASED'/);
    expect(releaseBlock).not.toMatch(/eventType:\s*'REDEEMED'/);
    expect(releaseBlock).not.toMatch(/eventType:\s*'VALUE_RESTORED'/);
  });

  it('release transitions RESERVED → RELEASED only — refuses to release COMMITTED', () => {
    const releaseBlock = SRC.slice(
      SRC.indexOf('export async function releaseByReservationId'),
      SRC.indexOf('function deterministicReservationId'),
    );
    expect(releaseBlock).toMatch(/eq\(egiftReservations\.status,\s*'RESERVED'\)/);
    expect(releaseBlock).toMatch(/RESERVATION_NOT_ACTIVE/);
  });
});

describe('§29 commit() writes REDEEMED and is single-shot', () => {
  it('commit writes REDEEMED, never RESERVATION_RELEASED / VALUE_RESTORED', () => {
    const commitBlock = SRC.slice(
      SRC.indexOf('export async function commitReservation'),
      SRC.indexOf('export async function releaseByReservationId'),
    );
    expect(commitBlock).toMatch(/eventType:\s*'REDEEMED'/);
    expect(commitBlock).not.toMatch(/eventType:\s*'RESERVATION_RELEASED'/);
    expect(commitBlock).not.toMatch(/eventType:\s*'VALUE_RESTORED'/);
  });

  it('commit transitions RESERVED → COMMITTED only — double-commit hits RESERVATION_NOT_ACTIVE', () => {
    const commitBlock = SRC.slice(
      SRC.indexOf('export async function commitReservation'),
      SRC.indexOf('export async function releaseByReservationId'),
    );
    expect(commitBlock).toMatch(/eq\(egiftReservations\.status,\s*'RESERVED'\)/);
    expect(commitBlock).toMatch(/RESERVATION_NOT_ACTIVE/);
  });
});

describe('TTL discipline', () => {
  it('reserve() caps ttlSeconds at 15 minutes and floors at 60 seconds', () => {
    // Math.min(Math.max(ttl*1000, 60_000), 15*60*1000) — the exact
    // cap the CEO §14 pinned. A caller asking for a 24h hold gets
    // 15 min, never trusted.
    expect(SRC).toMatch(/Math\.min\(Math\.max\(\(input\.ttlSeconds\s*\?\?\s*900\)\s*\*\s*1000,\s*60_000\),\s*15\s*\*\s*60\s*\*\s*1000\)/);
  });
});

describe('idempotency — deterministic reservation ids', () => {
  it('a repeat call with the same idempotencyKey returns the existing handle', () => {
    const reserveBlock = SRC.slice(
      SRC.indexOf('export async function reserveFromEgift'),
      SRC.indexOf('export async function commitReservation'),
    );
    expect(reserveBlock).toMatch(/if\s*\(input\.idempotencyKey\)/);
    expect(reserveBlock).toMatch(/eq\(egiftReservations\.idempotencyKey,\s*input\.idempotencyKey\)/);
    // Existing handle returns immediately — no second reservation.
    expect(reserveBlock).toMatch(/if\s*\(existing\.length > 0\)/);
  });

  it('deterministicReservationId hashes (egiftId, idempotencyKey) — same key → same id', () => {
    expect(SRC).toMatch(/function deterministicReservationId\(egiftId: string, idempotencyKey\?: string\)/);
    expect(SRC).toMatch(/createHash\('sha256'\)\.update\(`\$\{egiftId\}:\$\{seed\}`\)/);
  });
});

describe('P0 — reservation ops are bound to the AUTHORISED egiftId (cross-user burn)', () => {
  // The HTTP surface is
  //   /api/egift/:egiftId/reservations/:reservationId/commit|release
  // and it authorises :egiftId via assertEgiftOwnership. commitReservation and
  // releaseByReservationId used to resolve the row by :reservationId ALONE, so
  // owning ANY eGift authorised committing or releasing a reservation held
  // against someone else's — burning or cancelling a stranger's held value.
  // Reservation ids are derivable (RES- + sha256(egiftId + ':' + idempotencyKey),
  // client-chosen key), so this was not even guess-limited.
  const ROUTES = fs.readFileSync(
    path.resolve(__dirname, '..', 'routes', 'egift-balance.ts'),
    'utf8',
  );

  it('commitReservation takes a REQUIRED egiftId and filters both statements on it', () => {
    const block = SRC.slice(
      SRC.indexOf('export async function commitReservation'),
      SRC.indexOf('export async function releaseByReservationId'),
    );
    // Required (no `?`) in the input type.
    expect(block).toMatch(/\n\s*egiftId: string;/);
    // Bound on BOTH the read and the conditional write.
    const bindings = block.match(/eq\(egiftReservations\.egiftId, input\.egiftId\)/g) ?? [];
    expect(bindings.length).toBeGreaterThanOrEqual(2);
  });

  it('releaseByReservationId takes a REQUIRED egiftId and filters both statements on it', () => {
    const block = SRC.slice(SRC.indexOf('export async function releaseByReservationId'));
    expect(block).toMatch(/reservationId: string,[\s\S]{0,200}?egiftId: string,/);
    const bindings = block.match(/eq\(egiftReservations\.egiftId, egiftId\)/g) ?? [];
    expect(bindings.length).toBeGreaterThanOrEqual(2);
  });

  it('a cross-eGift reservation id is reported as NOT_FOUND — no existence oracle', () => {
    // Both helpers must fall through to the generic not-found code rather than
    // a distinct "wrong owner" code that would confirm the id exists.
    expect(SRC).not.toMatch(/RESERVATION_WRONG_EGIFT|RESERVATION_FORBIDDEN|status:\s*403/);
    expect(SRC).toMatch(/errorCode:\s*'RESERVATION_NOT_FOUND'/);
  });

  it('the routes pass the PATH egiftId (already ACL-checked), never a body-supplied one', () => {
    for (const op of ['commit', 'release']) {
      const start = ROUTES.indexOf(`router.post('/:egiftId/reservations/:reservationId/${op}'`);
      expect(start).toBeGreaterThan(-1);
      // Fixed window: the handler body contains nested `});` (the json()
      // calls), so an indexOf('});') slice would cut the block short.
      const block = ROUTES.slice(start, start + 1400);
      // egiftId is read from params and ACL-checked before the call.
      expect(block).toMatch(/const egiftId = String\(req\.params\.egiftId/);
      expect(block).toMatch(/assertEgiftOwnership\(egiftId, uid, req\)/);
      // ...and never taken from the request body.
      expect(block).not.toMatch(/req\.body\??\.?\[?['"]?egiftId/);
    }
    expect(ROUTES).toMatch(/releaseByReservationId\(reservationId, egiftId\)/);
  });
});
