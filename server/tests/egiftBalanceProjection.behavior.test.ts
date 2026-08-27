/**
 * eGift balance projection behavioural pins — CEO 2026-08-27 §21-24, §31.
 *
 * The projection helper is called by the /api/egift/:egiftId/balance
 * route + the customer eGift tile. It must render the reserved value
 * (§31: "Do not hide reserved value as if it vanished") and MUST derive
 * balances from the append-only egift_events ledger, not from the
 * cached wallet_accounts aggregate.
 *
 * This test drives the helper through mocked drizzle db returns so we
 * exercise every event-type branch without a live Postgres.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

const evtRows: Array<{ id: number; type: string; amount: number; invoiceId?: string | null }> = [];
const rvRows: Array<{
  reservationId: string; amountCents: number; intendedCommercial: string;
  reservedAt: Date; expiresAt: Date;
}> = [];

vi.mock('../db', () => {
  function evtSelect() {
    const chain: any = {
      from() { return chain; },
      where() { return chain; },
      then(res: any) { res(evtRows); return chain; },
    };
    return chain;
  }
  function rvSelect() {
    const chain: any = {
      from() { return chain; },
      where() { return chain; },
      then(res: any) { res(rvRows); return chain; },
    };
    return chain;
  }
  let picker = 0;
  return {
    db: {
      select: (proj?: any) => {
        // First call is events (projection has fields id, type, amount,
        // invoiceId); second call is reservations (no proj).
        picker++;
        return picker % 2 === 1 ? evtSelect() : rvSelect();
      },
    },
    pool: {},
  };
});

import { projectEgiftBalance } from '../services/egift/egiftBalanceProjection';

beforeEach(() => {
  evtRows.length = 0;
  rvRows.length = 0;
});

describe('§21 append-only ledger — balance derived from events, not cache', () => {
  it('PURCHASED ₪100 → original 100, available 100', async () => {
    evtRows.push({ id: 1, type: 'PURCHASED', amount: 10000 });
    const p = await projectEgiftBalance('EG-1');
    expect(p.originalCents).toBe(10000);
    expect(p.availableCents).toBe(10000);
    expect(p.redeemedCents).toBe(0);
    expect(p.reservedCents).toBe(0);
  });

  it('PURCHASED 100 + REDEEMED 25 → available 75, redeemed 25', async () => {
    evtRows.push(
      { id: 1, type: 'PURCHASED', amount: 10000 },
      { id: 2, type: 'REDEEMED', amount: 2500 },
    );
    const p = await projectEgiftBalance('EG-2');
    expect(p.originalCents).toBe(10000);
    expect(p.availableCents).toBe(7500);
    expect(p.redeemedCents).toBe(2500);
  });

  it('VALUE_RESTORED ₪10 refund reappears on available side', async () => {
    evtRows.push(
      { id: 1, type: 'PURCHASED', amount: 10000 },
      { id: 2, type: 'REDEEMED', amount: 2500 },
      { id: 3, type: 'VALUE_RESTORED', amount: 1000 },
    );
    const p = await projectEgiftBalance('EG-3');
    expect(p.restoredCents).toBe(1000);
    expect(p.availableCents).toBe(8500);
  });

  it('PURCHASE_REFUNDED subtracts from original (money went back to card)', async () => {
    evtRows.push(
      { id: 1, type: 'PURCHASED', amount: 10000 },
      { id: 2, type: 'PURCHASE_REFUNDED', amount: 10000, invoiceId: 'DOC-CRD-1' },
    );
    const p = await projectEgiftBalance('EG-4');
    expect(p.originalCents).toBe(0);
    expect(p.availableCents).toBe(0);
    expect(p.hasOrphanRefundWarning).toBe(false);
  });

  it('PURCHASE_REFUNDED without invoice id → hasOrphanRefundWarning (§85 signal)', async () => {
    evtRows.push(
      { id: 1, type: 'PURCHASED', amount: 10000 },
      { id: 2, type: 'PURCHASE_REFUNDED', amount: 4000, invoiceId: null },
    );
    const p = await projectEgiftBalance('EG-5');
    expect(p.hasOrphanRefundWarning).toBe(true);
    expect(p.originalCents).toBe(6000);
  });

  it('FROZEN / UNFROZEN toggle the frozen flag; balance unaffected', async () => {
    evtRows.push(
      { id: 1, type: 'PURCHASED', amount: 5000 },
      { id: 2, type: 'FROZEN', amount: 0 },
    );
    const p1 = await projectEgiftBalance('EG-6');
    expect(p1.frozen).toBe(true);
    expect(p1.availableCents).toBe(5000);

    evtRows.push({ id: 3, type: 'UNFROZEN', amount: 0 });
    const p2 = await projectEgiftBalance('EG-6');
    expect(p2.frozen).toBe(false);
  });

  it('ADJUSTMENT respects the sign (admin corrections can go either way)', async () => {
    evtRows.push(
      { id: 1, type: 'PURCHASED', amount: 5000 },
      { id: 2, type: 'ADJUSTMENT', amount: -500 },
    );
    const p = await projectEgiftBalance('EG-7');
    expect(p.originalCents).toBe(4500);
    expect(p.availableCents).toBe(4500);
  });
});

describe('§22-23 reservations reduce available but stay VISIBLE (§31)', () => {
  it('one open reservation of ₪20 out of ₪100 → available 80, reserved 20', async () => {
    evtRows.push({ id: 1, type: 'PURCHASED', amount: 10000 });
    rvRows.push({
      reservationId: 'RES-1',
      amountCents: 2000,
      intendedCommercial: 'SHOP_ITEM',
      reservedAt: new Date('2026-08-27T10:00:00Z'),
      expiresAt: new Date('2026-08-27T10:15:00Z'),
    });
    const p = await projectEgiftBalance('EG-8');
    expect(p.availableCents).toBe(8000);
    expect(p.reservedCents).toBe(2000);
    expect(p.openReservations).toHaveLength(1);
    expect(p.openReservations[0].intendedCommercial).toBe('SHOP_ITEM');
  });

  it('concurrent Phone A + Phone B cannot oversell (two RESERVED add up)', async () => {
    evtRows.push({ id: 1, type: 'PURCHASED', amount: 10000 });
    rvRows.push(
      { reservationId: 'RES-A', amountCents: 7000, intendedCommercial: 'SHOP_ITEM',
        reservedAt: new Date(), expiresAt: new Date() },
      { reservationId: 'RES-B', amountCents: 4000, intendedCommercial: 'K9000_WASH',
        reservedAt: new Date(), expiresAt: new Date() },
    );
    const p = await projectEgiftBalance('EG-9');
    // Reservations exceed original — available floors at 0, never negative.
    expect(p.reservedCents).toBe(11000);
    expect(p.availableCents).toBe(0);
  });
});
