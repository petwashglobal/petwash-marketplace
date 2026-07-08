/**
 * Cron / refund money-safety — regression pins (2026-07-08).
 *
 * From the cron+refund money-integrity sweep:
 *
 * #4 — auto-void-expired-payments called
 *        NayaxJobDispatchPaymentService.voidPayment(id, reason)   // positional
 *      but the method takes a single VoidPaymentParams object { paymentIntentId,
 *      reason }. So params = the id string, params.paymentIntentId = undefined →
 *      the intent lookup failed and EVERY void was a silent no-op (expired card
 *      holds never released). Fixed to the object form.
 *
 * #2 — dispute /resolve credited/released escrow inside a tx whose only
 *      settled-status guard was a plain read BEFORE the tx. Two concurrent
 *      resolves both passed it and both moved money. Each escrow UPDATE is now
 *      CONDITIONAL (WHERE ... AND status NOT IN ('refunded','released')) with a
 *      rowCount===0 → ROLLBACK, atomic under Postgres row-locking.
 *
 * NOT in this batch (flagged, needs a dedicated infra + migration pass):
 *   - auto-approve + monthly-settlements crons run on every replica (no instance
 *     lock) and contractor_earnings/settlements have no backing unique index →
 *     double-payout on a lockless SELECT-then-INSERT. Requires exposing the
 *     Redis leader-lock AND a dup-scanned unique index on the live money ledger.
 *
 * Source-level pins (same style as credit-wallet-confirm-idor.test.ts).
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

const VOID = fs.readFileSync(path.resolve(__dirname, '..', 'cron', 'auto-void-expired-payments.ts'), 'utf8');
const DISPUTES = fs.readFileSync(path.resolve(__dirname, '..', 'routes', 'disputes.ts'), 'utf8');

describe('cron / refund money-safety (2026-07-08)', () => {
  it('#4 auto-void calls voidPayment with a VoidPaymentParams object (not positional)', () => {
    expect(VOID).toMatch(/voidPayment\(\{\s*paymentIntentId:\s*paymentIntent\.id!,\s*reason:/);
    // the broken positional form must be gone
    expect(VOID).not.toMatch(/voidPayment\(\s*paymentIntent\.id!,\s*['"]/);
  });

  it('#2 every dispute escrow settle is CONDITIONAL on not-already-settled', () => {
    const guarded = DISPUTES.match(/WHERE escrow_id = \$\d+ AND status NOT IN \('refunded', 'released'\)/g) ?? [];
    // customer_favor + provider_favor + split = 3 guarded UPDATEs
    expect(guarded.length).toBe(3);
  });

  it('#2 a 0-row escrow update rolls back and rejects the concurrent resolution', () => {
    const rollbacks = DISPUTES.match(/rowCount === 0\)\s*\{\s*\n\s*await client\.query\('ROLLBACK'\)/g) ?? [];
    expect(rollbacks.length).toBe(3);
    expect(DISPUTES).toMatch(/concurrent resolution rejected/);
  });
});
