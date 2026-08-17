/**
 * Regression pin — BookingLifecycleService had two SELECT-then-UPDATE
 * races:
 *   1. transitionStatus: unconditional status UPDATE let concurrent
 *      transitions from the same currentStatus both succeed → duplicate
 *      history rows + duplicate side effects (createEscrowHolding,
 *      scheduleEscrowRelease, settleEscrowTerminal).
 *   2. settleEscrowTerminal: SELECT then UPDATE escrow status → two
 *      concurrent terminal transitions both emitted
 *      BOOKING_ESCROW_REFUNDED.
 * Lane B (2026-08-17) turned both into conditional UPDATEs
 * (WHERE status = observed) + short-circuit on 0 rows.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const src = readFileSync(
  join(__dirname, '..', '..', 'server', 'services', 'BookingLifecycleService.ts'),
  'utf8',
);

describe('BookingLifecycleService.transitionStatus race guard', () => {
  it('gates the UPDATE on WHERE bookings.status = currentStatus', () => {
    // The conditional predicate is the load-bearing safety pin.
    const fnStart = src.indexOf('async transitionStatus(');
    expect(fnStart).toBeGreaterThan(-1);
    const body = src.slice(fnStart, fnStart + 4000);
    expect(body).toMatch(/and\(eq\(bookings\.id,\s*bookingId\),\s*eq\(bookings\.status,\s*currentStatus\)\)/);
  });

  it('short-circuits (returns) when 0 rows updated', () => {
    const fnStart = src.indexOf('async transitionStatus(');
    const body = src.slice(fnStart, fnStart + 4000);
    expect(body).toMatch(/claimed\.length\s*===\s*0[\s\S]{0,300}?return/);
  });
});

describe('BookingLifecycleService.settleEscrowTerminal race guard', () => {
  it('gates the escrow UPDATE on WHERE escrowHoldings.status = observed status', () => {
    const fnStart = src.indexOf('private async settleEscrowTerminal(');
    expect(fnStart).toBeGreaterThan(-1);
    const body = src.slice(fnStart, fnStart + 2000);
    expect(body).toMatch(/eq\(escrowHoldings\.status,\s*escrow\.status\)/);
  });

  it('does not emit BOOKING_ESCROW_REFUNDED on a lost race', () => {
    const fnStart = src.indexOf('private async settleEscrowTerminal(');
    const body = src.slice(fnStart, fnStart + 2000);
    // The audit call must come AFTER the claimed.length === 0 guard,
    // so the losing racer never emits a duplicate audit row.
    const guardAt = body.indexOf('claimed.length === 0');
    const auditAt = body.indexOf("'BOOKING_ESCROW_REFUNDED'");
    expect(guardAt).toBeGreaterThan(-1);
    expect(auditAt).toBeGreaterThan(-1);
    expect(guardAt).toBeLessThan(auditAt);
  });
});
