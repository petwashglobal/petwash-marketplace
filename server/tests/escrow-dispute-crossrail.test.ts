/**
 * Escrow-dispute cross-rail visibility — regression pin (2026-07-08).
 *
 * Money-integrity hunt, MEDIUM finding:
 * A dispute filed via POST /api/escrow/:id/dispute wrote the Firestore escrow
 * doc's `autoReleaseBlocked` flag (freezing the ESCROW rail's auto-release) but
 * created NO row in the SQL `booking_disputes` table. The SQL payout gate
 * (payoutGate.ts gate (d)) reads booking_disputes ONLY — so the parallel
 * contractor_earnings / super_app_payouts for the SAME booking stayed invisible
 * to the dispute and still auto-released after the refund window.
 *
 * Fix: the dispute route now mirrors the dispute into booking_disputes (keyed on
 * escrow.bookingId — the same identifier the gate resolves against), status
 * 'open', so EVERY payout rail holds. This pins that mirror + the gate contract.
 * Source-level assertions (same style as credit-wallet-confirm-idor.test.ts).
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

const ROUTE = fs.readFileSync(path.resolve(__dirname, '..', 'routes', 'escrow.ts'), 'utf8');
const GATE = fs.readFileSync(path.resolve(__dirname, '..', 'services', 'payoutGate.ts'), 'utf8');

describe('escrow dispute cross-rail visibility (2026-07-08)', () => {
  it('the dispute route mirrors into booking_disputes keyed on the escrow bookingId', () => {
    expect(ROUTE).toMatch(/\.insert\(bookingDisputes\)/);
    expect(ROUTE).toMatch(/bookingId:\s*String\(escrow\.bookingId\)/);
  });

  it('the mirrored dispute is OPEN so gate (d) holds the payout', () => {
    expect(ROUTE).toMatch(/status:\s*'open'/);
  });

  it('gate (d) reads booking_disputes and treats "open" as an open dispute', () => {
    expect(GATE).toMatch(/\.from\(bookingDisputes\)/);
    expect(GATE).toMatch(/OPEN_DISPUTE_STATUSES\s*=\s*new Set\(\[[^\]]*'open'/);
  });

  it('the mirror is de-duped (checks for an existing open dispute first)', () => {
    expect(ROUTE).toMatch(/eq\(bookingDisputes\.status,\s*'open'\)/);
  });
});
